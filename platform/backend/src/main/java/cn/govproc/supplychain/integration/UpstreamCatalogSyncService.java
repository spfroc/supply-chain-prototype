package cn.govproc.supplychain.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class UpstreamCatalogSyncService {
    private static final Logger log = LoggerFactory.getLogger(UpstreamCatalogSyncService.class);
    private static final String PROVIDER = "miniapps";
    private final JdbcClient jdbc;
    private final MiniappsClient client;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;
    private final java.util.concurrent.Executor background;
    private final ExecutorService detailPool;
    private final int pageSize;
    private volatile boolean messagePolling;

    public UpstreamCatalogSyncService(JdbcClient jdbc, MiniappsClient client,
        PlatformTransactionManager transactionManager, @Qualifier("collectJobExecutor") java.util.concurrent.Executor taskExecutor,
        @Value("${app.miniapps.sync-page-size:100}") int pageSize,
        @Value("${app.miniapps.detail-concurrency:16}") int concurrency) {
        this.jdbc = jdbc;
        this.client = client;
        this.mapper = new ObjectMapper();
        this.tx = new TransactionTemplate(transactionManager);
        this.background = taskExecutor;
        this.pageSize = Math.max(1, Math.min(pageSize, 100));
        this.detailPool = Executors.newFixedThreadPool(Math.max(1, Math.min(concurrency, 32)));
    }

    public long startFullSync() {
        int active = jdbc.sql("SELECT COUNT(*) FROM upstream_product_sync_job WHERE status IN ('PENDING','RUNNING')")
            .query(Integer.class).single();
        if (active > 0) throw new IllegalStateException("已有商品同步任务在执行");
        jdbc.sql("INSERT INTO upstream_product_sync_job(status) VALUES('PENDING')").update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        background.execute(() -> runFullSync(id));
        return id;
    }

    public Map<String,Object> job(long id) {
        List<Map<String,Object>> rows = jdbc.sql("""
            SELECT id,status,total_count AS totalCount,total_pages AS totalPages,current_page AS currentPage,
              success_count AS successCount,fail_count AS failCount,error_message AS errorMessage,
              DATE_FORMAT(started_at,'%Y-%m-%d %H:%i:%s') AS startedAt,
              DATE_FORMAT(finished_at,'%Y-%m-%d %H:%i:%s') AS finishedAt
            FROM upstream_product_sync_job WHERE id=:id
            """).param("id",id).query().listOfRows();
        if (rows.isEmpty()) throw new IllegalArgumentException("同步任务不存在");
        return rows.get(0);
    }

    void runFullSync(long jobId) {
        jdbc.sql("UPDATE upstream_product_sync_job SET status='RUNNING',started_at=NOW() WHERE id=:id")
            .param("id",jobId).update();
        try {
            int page = 0;
            JsonNode first = client.goodsPage(page, pageSize);
            int total = first.path("total").asInt();
            int pages = first.path("total_page").asInt((total + pageSize - 1) / pageSize);
            jdbc.sql("UPDATE upstream_product_sync_job SET total_count=:total,total_pages=:pages WHERE id=:id")
                .param("total",total).param("pages",pages).param("id",jobId).update();
            while (page < pages) {
                JsonNode listing = page == 0 ? first : client.goodsPage(page, pageSize);
                List<JsonNode> summaries = nodes(listing.path("goods_list"));
                List<DetailResult> details = summaries.stream().map(summary -> CompletableFuture
                    .supplyAsync(() -> fetchWithRetry(summary), detailPool)).map(CompletableFuture::join).toList();
                AtomicInteger succeeded = new AtomicInteger();
                AtomicInteger failed = new AtomicInteger();
                tx.executeWithoutResult(ignored -> details.forEach(result -> {
                    if (result.detail() == null) failed.incrementAndGet();
                    else { upsertProduct(result.detail()); succeeded.incrementAndGet(); }
                }));
                page++;
                jdbc.sql("""
                    UPDATE upstream_product_sync_job SET current_page=:page,
                      success_count=success_count+:success,fail_count=fail_count+:failed WHERE id=:id
                    """).param("page",page).param("success",succeeded.get()).param("failed",failed.get())
                    .param("id",jobId).update();
            }
            jdbc.sql("UPDATE upstream_product_sync_job SET status=IF(fail_count=0,'SUCCEEDED','PARTIAL'),finished_at=NOW() WHERE id=:id")
                .param("id",jobId).update();
        } catch (Exception exception) {
            log.error("upstream full product sync {} failed", jobId, exception);
            jdbc.sql("UPDATE upstream_product_sync_job SET status='FAILED',error_message=:error,finished_at=NOW() WHERE id=:id")
                .param("error",trim(exception.getMessage(),1000)).param("id",jobId).update();
        }
    }

    private DetailResult fetchWithRetry(JsonNode summary) {
        long sku = summary.path("sku").asLong();
        int library = summary.path("library").asInt();
        for (int attempt=1; attempt<=3; attempt++) {
            try { return new DetailResult(sku, library, client.goodsDetail(sku, library), null); }
            catch (Exception error) {
                if (attempt == 3) return new DetailResult(sku, library, null, error.getMessage());
                try { Thread.sleep(250L * attempt); } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    return new DetailResult(sku, library, null, "同步线程已中断");
                }
            }
        }
        return new DetailResult(sku, library, null, "未知错误");
    }

    void upsertProduct(JsonNode detail) {
        String externalSku = detail.path("sku").asText();
        int library = detail.path("library").asInt();
        String skuCode = "MINI-" + library + "-" + externalSku;
        String title = trim(detail.path("title").asText("未命名商品"), 200);
        long categoryId = ensureCategory(detail.path("cid_title").asText(), detail.path("cid").asText());
        long brandId = ensureBrand(detail.path("brand_name").asText());
        BigDecimal member = money(detail.path("shop_price").asText());
        BigDecimal market = money(detail.path("line_price").asText());
        if (market.signum() <= 0) market = member;
        int stock = Math.max(0, detail.path("stock").asInt());
        String mainImage = trim(detail.path("main_image").asText(),500);
        String gallery = json(nodes(detail.path("swiper")).stream().map(JsonNode::asText).filter(s -> !s.isBlank()).toList());
        String attributes = json(detail.path("attribute"));
        String detailHtml = detailHtml(detail.path("content"));
        Long productId = jdbc.sql("SELECT product_id FROM upstream_product_mapping WHERE provider=:provider AND external_sku=:sku AND library=:library")
            .param("provider",PROVIDER).param("sku",externalSku).param("library",library).query(Long.class).optional().orElse(null);
        if (productId == null) {
            jdbc.sql("""
                INSERT INTO product_spu(spu_code,title,category_id,brand_id,main_image,gallery_json,attributes_json,
                  detail_html,status,collection_platform,collection_source_url)
                VALUES(:code,:title,:category,:brand,:image,CAST(:gallery AS JSON),CAST(:attributes AS JSON),
                  :detail,1,'huiecai',:source)
                """).param("code","MINI-SPU-"+library+"-"+externalSku).param("title",title)
                .param("category",categoryId).param("brand",brandId).param("image",mainImage)
                .param("gallery",gallery).param("attributes",attributes).param("detail",detailHtml)
                .param("source","https://hwly.miniappss.com/goodsInfo/"+externalSku+".html").update();
            productId = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
            jdbc.sql("""
                INSERT INTO product_sku(spu_id,sku_code,title,spec_json,sku_image,gallery_json,market_price,member_price,stock,status)
                VALUES(:product,:sku,:title,CAST(:spec AS JSON),:image,CAST(:gallery AS JSON),:market,:member,:stock,1)
                """).param("product",productId).param("sku",skuCode).param("title",title)
                .param("spec",json(detail.path("variety"))).param("image",mainImage).param("gallery",gallery)
                .param("market",market).param("member",member).param("stock",stock).update();
            jdbc.sql("INSERT INTO upstream_product_mapping(provider,external_sku,library,product_id,raw_json,last_synced_at) VALUES(:provider,:sku,:library,:product,:raw,NOW())")
                .param("provider",PROVIDER).param("sku",externalSku).param("library",library).param("product",productId)
                .param("raw",detail.toString()).update();
        } else {
            jdbc.sql("""
                UPDATE product_spu SET title=:title,category_id=:category,brand_id=:brand,main_image=:image,
                  gallery_json=CAST(:gallery AS JSON),attributes_json=CAST(:attributes AS JSON),detail_html=:detail,
                  status=1,deleted_at=NULL WHERE id=:id
                """).param("id",productId).param("title",title).param("category",categoryId).param("brand",brandId)
                .param("image",mainImage).param("gallery",gallery).param("attributes",attributes).param("detail",detailHtml).update();
            jdbc.sql("""
                UPDATE product_sku SET title=:title,spec_json=CAST(:spec AS JSON),sku_image=:image,
                  gallery_json=CAST(:gallery AS JSON),market_price=:market,member_price=:member,stock=GREATEST(:stock,reserved_stock),
                  status=1,deleted_at=NULL WHERE spu_id=:product AND sku_code=:sku
                """).param("product",productId).param("sku",skuCode).param("title",title)
                .param("spec",json(detail.path("variety"))).param("image",mainImage).param("gallery",gallery)
                .param("market",market).param("member",member).param("stock",stock).update();
            jdbc.sql("UPDATE upstream_product_mapping SET raw_json=:raw,last_synced_at=NOW() WHERE provider=:provider AND external_sku=:sku AND library=:library")
                .param("raw",detail.toString()).param("provider",PROVIDER).param("sku",externalSku).param("library",library).update();
        }
    }

    @Scheduled(fixedDelayString="${app.miniapps.message-poll-ms:30000}", initialDelayString="${app.miniapps.message-initial-delay-ms:15000}")
    public void pollMessages() {
        if (messagePolling) return;
        messagePolling = true;
        try {
            List<JsonNode> messages = client.messages();
            for (JsonNode message : messages) processMessage(message);
        } catch (IllegalStateException unconfigured) {
            if (!unconfigured.getMessage().contains("未配置")) log.warn("upstream message polling failed: {}",unconfigured.getMessage());
        } catch (Exception error) {
            log.warn("upstream message polling failed",error);
        } finally { messagePolling = false; }
    }

    private void processMessage(JsonNode message) {
        long remoteId = message.path("id").asLong();
        int type = message.path("type").asInt();
        String content = message.path("json_data").asText("{}");
        jdbc.sql("""
            INSERT INTO upstream_message(provider,remote_message_id,message_type,message_content)
            VALUES(:provider,:remoteId,:type,:content)
            ON DUPLICATE KEY UPDATE message_content=VALUES(message_content),message_type=VALUES(message_type)
            """).param("provider",PROVIDER).param("remoteId",remoteId).param("type",type).param("content",content).update();
        try {
            if (type >= 1 && type <= 4) applyProductMessage(type, mapper.readTree(content));
            jdbc.sql("UPDATE upstream_message SET process_status=:status,process_result=:result,processed_at=NOW() WHERE provider=:provider AND remote_message_id=:id")
                .param("status",type >= 1 && type <= 4 ? "PROCESSED" : "IGNORED")
                .param("result",type >= 1 && type <= 4 ? "商品变更已同步" : "非商品消息，按规则直接删除")
                .param("provider",PROVIDER).param("id",remoteId).update();
            client.deleteMessages(List.of(remoteId));
            jdbc.sql("UPDATE upstream_message SET remote_deleted=1,deleted_at=NOW() WHERE provider=:provider AND remote_message_id=:id")
                .param("provider",PROVIDER).param("id",remoteId).update();
        } catch (Exception error) {
            jdbc.sql("UPDATE upstream_message SET process_status='FAILED',process_result=:result,processed_at=NOW() WHERE provider=:provider AND remote_message_id=:id")
                .param("result",trim(error.getMessage(),1000)).param("provider",PROVIDER).param("id",remoteId).update();
        }
    }

    private void applyProductMessage(int type, JsonNode data) {
        String sku = data.path("sku").asText();
        int library = data.path("library").asInt();
        Long productId = jdbc.sql("SELECT product_id FROM upstream_product_mapping WHERE provider=:provider AND external_sku=:sku AND library=:library")
            .param("provider",PROVIDER).param("sku",sku).param("library",library).query(Long.class).optional().orElse(null);
        if (type == 2 && "del".equalsIgnoreCase(data.path("ope").asText())) {
            if (productId == null) return;
            jdbc.sql("UPDATE product_spu SET status=2,deleted_at=NOW() WHERE id=:id").param("id",productId).update();
            jdbc.sql("UPDATE product_sku SET status=0,deleted_at=NOW() WHERE spu_id=:id").param("id",productId).update();
            return;
        }
        if (productId == null || type >= 2) {
            DetailResult result = fetchWithRetry(mapper.createObjectNode().put("sku",sku).put("library",library));
            if (result.detail() == null) throw new IllegalStateException(result.error());
            upsertProduct(result.detail());
            productId = jdbc.sql("SELECT product_id FROM upstream_product_mapping WHERE provider=:provider AND external_sku=:sku AND library=:library")
                .param("provider",PROVIDER).param("sku",sku).param("library",library).query(Long.class).single();
        }
        if (type == 1) {
            int state = data.path("state").asInt();
            jdbc.sql("UPDATE product_spu SET status=:state WHERE id=:id").param("state",state==1?1:2).param("id",productId).update();
            jdbc.sql("UPDATE product_sku SET status=:state WHERE spu_id=:id").param("state",state==1?1:0).param("id",productId).update();
        }
    }

    private long ensureCategory(String title, String cid) {
        long root = ensureCategoryNode("外部同步商品",null,1);
        long second = ensureCategoryNode("子商城商品",root,2);
        String leaf = title == null || title.isBlank() ? (cid == null || cid.isBlank() || "0".equals(cid) ? "未分类" : "分类"+cid) : title;
        return ensureCategoryNode(trim(leaf,50),second,3);
    }

    private long ensureCategoryNode(String name, Long parent, int level) {
        var query = parent == null
            ? jdbc.sql("SELECT id FROM category WHERE name=:name AND parent_id IS NULL ORDER BY id LIMIT 1").param("name",name)
            : jdbc.sql("SELECT id FROM category WHERE name=:name AND parent_id=:parent ORDER BY id LIMIT 1").param("name",name).param("parent",parent);
        Long id = query.query(Long.class).optional().orElse(null);
        if (id != null) return id;
        jdbc.sql("INSERT INTO category(name,parent_id,level,status) VALUES(:name,:parent,:level,1)")
            .param("name",name).param("parent",parent).param("level",level).update();
        return jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
    }

    private long ensureBrand(String raw) {
        String name = raw == null || raw.isBlank() ? "无品牌" : trim(raw,100);
        Long id = jdbc.sql("SELECT id FROM brand WHERE name=:name LIMIT 1").param("name",name).query(Long.class).optional().orElse(null);
        if (id != null) { jdbc.sql("UPDATE brand SET status=1,deleted_at=NULL WHERE id=:id").param("id",id).update(); return id; }
        jdbc.sql("INSERT INTO brand(name,status) VALUES(:name,1)").param("name",name).update();
        return jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
    }

    private String detailHtml(JsonNode content) {
        StringBuilder html = new StringBuilder();
        if (content.isArray()) content.forEach(node -> { if (!node.asText().isBlank()) html.append("<p><img src=\"").append(node.asText().replace("\"","&quot;")).append("\" /></p>"); });
        return html.toString();
    }
    private List<JsonNode> nodes(JsonNode node) { var out=new ArrayList<JsonNode>(); if(node.isArray()) node.forEach(out::add); return out; }
    private String json(Object value) { try{return mapper.writeValueAsString(value);}catch(Exception error){throw new IllegalStateException("商品 JSON 序列化失败",error);} }
    private BigDecimal money(String value) { try{return new BigDecimal(value);}catch(Exception ignored){return BigDecimal.ZERO;} }
    private static String trim(String value,int max){String safe=Objects.toString(value,"");return safe.length()>max?safe.substring(0,max):safe;}
    private record DetailResult(long sku,int library,JsonNode detail,String error) {}
    @PreDestroy void close(){detailPool.shutdownNow();}
}
