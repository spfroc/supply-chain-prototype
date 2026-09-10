package cn.govproc.supplychain.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.ConcurrentHashMap;
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
    private final Map<String,String> categoryTitleCache = new ConcurrentHashMap<>();
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

    public Map<String,Object> latestJob() {
        List<Map<String,Object>> rows = jdbc.sql("""
            SELECT id,status,total_count AS totalCount,total_pages AS totalPages,current_page AS currentPage,
              success_count AS successCount,fail_count AS failCount,error_message AS errorMessage,
              DATE_FORMAT(started_at,'%Y-%m-%d %H:%i:%s') AS startedAt,
              DATE_FORMAT(finished_at,'%Y-%m-%d %H:%i:%s') AS finishedAt
            FROM upstream_product_sync_job ORDER BY id DESC LIMIT 1
            """).query().listOfRows();
        if (!rows.isEmpty()) return rows.getFirst();
        long synchronizedCount = jdbc.sql("SELECT COUNT(*) FROM upstream_product_mapping WHERE provider=:provider")
            .param("provider",PROVIDER).query(Long.class).single();
        return new LinkedHashMap<>(Map.of(
            "status","IDLE","totalCount",synchronizedCount,"successCount",synchronizedCount,
            "failCount",0,"currentPage",0,"totalPages",0
        ));
    }

    void runFullSync(long jobId) {
        jdbc.sql("UPDATE upstream_product_sync_job SET status='RUNNING',started_at=NOW() WHERE id=:id")
            .param("id",jobId).update();
        try {
            synchronizeCategories();
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
                .param("error","商品同步失败，系统已保留当前进度，请重新点击同步继续处理")
                .param("id",jobId).update();
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
        long categoryId = ensureCategory(detail);
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
        if(productId==null){
            productId=jdbc.sql("""
              SELECT p.id FROM product_spu p LEFT JOIN product_sku s ON s.spu_id=p.id
              WHERE p.spu_code=:spuCode OR s.sku_code=:skuCode ORDER BY p.id LIMIT 1
              """).param("spuCode","MINI-SPU-"+library+"-"+externalSku).param("skuCode",skuCode)
              .query(Long.class).optional().orElse(null);
            if(productId!=null)jdbc.sql("""
              INSERT INTO upstream_product_mapping(provider,external_sku,library,product_id,raw_json,last_synced_at)
              VALUES(:provider,:sku,:library,:product,:raw,NOW())
              ON DUPLICATE KEY UPDATE product_id=VALUES(product_id),raw_json=VALUES(raw_json),last_synced_at=NOW()
              """).param("provider",PROVIDER).param("sku",externalSku).param("library",library)
              .param("product",productId).param("raw",detail.toString()).update();
        }
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
        saveStructuredAttributes(productId, categoryId, detail.path("attribute"));
    }

    @Scheduled(fixedDelayString="${app.miniapps.message-poll-ms:300000}", initialDelayString="${app.miniapps.message-initial-delay-ms:15000}")
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

    private void synchronizeCategories() {
        JsonNode roots = client.categories(0).path("list");
        for (JsonNode root : nodes(roots)) {
            long localRoot = saveCategory(root, null, 1);
            long externalRoot = root.path("id").asLong();
            for (JsonNode child : nodes(client.categories(externalRoot).path("list"))) saveCategory(child, localRoot, 2);
        }
    }

    private long saveCategory(JsonNode source, Long parentId, int level) {
        String externalId = source.path("id").asText();
        String name = trim(source.path("title").asText("未命名分类"),50);
        long categoryId = ensureCategoryNode(name,parentId,level);
        jdbc.sql("""
            INSERT INTO upstream_category_mapping(provider,external_category_id,category_id,external_parent_id,raw_json,last_synced_at)
            VALUES(:provider,:externalId,:categoryId,:parentId,:raw,NOW())
            ON DUPLICATE KEY UPDATE category_id=VALUES(category_id),external_parent_id=VALUES(external_parent_id),
              raw_json=VALUES(raw_json),last_synced_at=NOW()
            """).param("provider",PROVIDER).param("externalId",externalId).param("categoryId",categoryId)
            .param("parentId",source.path("parent_id").asText()).param("raw",source.toString()).update();
        return categoryId;
    }

    private long ensureCategory(JsonNode detail) {
        String cid=detail.path("cid").asText();
        long parentExternalId=detail.path("parent_id").asLong(0);
        if (cid != null && !cid.isBlank() && !"0".equals(cid)) {
            Long mapped = jdbc.sql("SELECT category_id FROM upstream_category_mapping WHERE provider=:provider AND external_category_id=:cid")
                .param("provider",PROVIDER).param("cid",cid).query(Long.class).optional().orElse(null);
            if (mapped != null) {
                Long localParent=jdbc.sql("SELECT parent_id FROM category WHERE id=:id AND deleted_at IS NULL")
                    .param("id",mapped).query(Long.class).optional().orElse(null);
                if(parentExternalId<=0||localParent!=null)return mapped;
            }
        }
        String childFallback=detail.path("cid_title").asText();
        if(parentExternalId<=0){
            String name=categoryTitle(cid,childFallback);
            long id=ensureCategoryNode(name,null,1);
            saveCategoryMapping(cid,id,"0",detail);
            return id;
        }
        String parentExternal=String.valueOf(parentExternalId);
        Long parentId=jdbc.sql("SELECT category_id FROM upstream_category_mapping WHERE provider=:provider AND external_category_id=:cid")
            .param("provider",PROVIDER).param("cid",parentExternal).query(Long.class).optional().orElse(null);
        if(parentId==null){
            String parentName=categoryTitle(parentExternal,"未分类");
            parentId=ensureCategoryNode(parentName,null,1);
            saveCategoryMapping(parentExternal,parentId,"0",null);
        }
        String childName=categoryTitle(cid,childFallback);
        long childId=ensureCategoryNode(childName,parentId,2);
        saveCategoryMapping(cid,childId,parentExternal,detail);
        return childId;
    }

    private String categoryTitle(String externalId,String fallback){
        String safeFallback=fallback==null||fallback.isBlank()?"未分类":trim(fallback,50);
        if(externalId==null||externalId.isBlank()||"0".equals(externalId))return safeFallback;
        return categoryTitleCache.computeIfAbsent(externalId,key->{
            try{String title=client.categories(Long.parseLong(key)).path("title").asText();return title.isBlank()?safeFallback:trim(title,50);}
            catch(Exception error){log.warn("upstream category {} lookup failed: {}",key,error.getMessage());return safeFallback;}
        });
    }

    private void saveCategoryMapping(String externalId,long categoryId,String externalParentId,JsonNode raw){
        if(externalId==null||externalId.isBlank()||"0".equals(externalId))return;
        jdbc.sql("""
          INSERT INTO upstream_category_mapping(provider,external_category_id,category_id,external_parent_id,raw_json,last_synced_at)
          VALUES(:provider,:externalId,:categoryId,:parentId,:raw,NOW())
          ON DUPLICATE KEY UPDATE category_id=VALUES(category_id),external_parent_id=VALUES(external_parent_id),
            raw_json=VALUES(raw_json),last_synced_at=NOW()
          """).param("provider",PROVIDER).param("externalId",externalId).param("categoryId",categoryId)
          .param("parentId",externalParentId).param("raw",raw==null?null:raw.toString()).update();
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

    private void saveStructuredAttributes(long productId, long categoryId, JsonNode attributes) {
        List<JsonNode> sources=new ArrayList<>();
        if(attributes.isArray())attributes.forEach(sources::add);
        else if(attributes.isObject())attributes.fields().forEachRemaining(entry->{
            var node=mapper.createObjectNode();node.put("name",entry.getKey());node.set("value",entry.getValue());sources.add(node);
        });
        for (JsonNode source : sources) {
            String name = trim(source.path("name").asText(),100);
            JsonNode valueNode=source.path("value");
            String value=valueNode.isArray()?String.join("、",nodes(valueNode).stream().map(JsonNode::asText).filter(v->!v.isBlank()).toList()):valueNode.asText();
            if (name.isBlank() || value.isBlank()) continue;
            Long attributeId = jdbc.sql("SELECT id FROM attribute_definition WHERE name=:name AND deleted_at IS NULL ORDER BY id LIMIT 1")
                .param("name",name).query(Long.class).optional().orElse(null);
            if (attributeId == null) {
                String code = "UPSTREAM_" + digest(name).substring(0,16);
                jdbc.sql("""
                    INSERT INTO attribute_definition(code,name,group_name,attribute_type,input_type,required_flag,
                      filterable,searchable,visible_flag,allow_custom,sort_order,status)
                    VALUES(:code,:name,'规格参数','BASIC','TEXT',0,0,0,1,1,100,1)
                    ON DUPLICATE KEY UPDATE name=VALUES(name),status=1,deleted_at=NULL
                    """).param("code",code).param("name",name).update();
                attributeId = jdbc.sql("SELECT id FROM attribute_definition WHERE code=:code")
                    .param("code",code).query(Long.class).single();
            }
            jdbc.sql("INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order) VALUES(:category,:attribute,100)")
                .param("category",categoryId).param("attribute",attributeId).update();
            String inputType=jdbc.sql("SELECT input_type FROM attribute_definition WHERE id=:id")
                .param("id",attributeId).query(String.class).single();
            if(List.of("SELECT","RADIO","CHECKBOX").contains(inputType)){
                String optionCode="UPSTREAM_"+digest(value).substring(0,16);
                jdbc.sql("""
                  INSERT INTO attribute_option(attribute_id,option_code,option_label,status)
                  VALUES(:attribute,:code,:label,1)
                  ON DUPLICATE KEY UPDATE option_label=VALUES(option_label),status=1,deleted_at=NULL
                  """).param("attribute",attributeId).param("code",optionCode).param("label",trim(value,100)).update();
                long optionId=jdbc.sql("SELECT id FROM attribute_option WHERE attribute_id=:attribute AND option_code=:code")
                    .param("attribute",attributeId).param("code",optionCode).query(Long.class).single();
                jdbc.sql("""
                  INSERT INTO product_attribute_value(product_id,attribute_id,value_text,option_ids)
                  VALUES(:product,:attribute,:value,CAST(:options AS JSON))
                  ON DUPLICATE KEY UPDATE value_text=VALUES(value_text),option_ids=VALUES(option_ids)
                  """).param("product",productId).param("attribute",attributeId).param("value",value)
                  .param("options",json(List.of(optionId))).update();
            }else jdbc.sql("""
              INSERT INTO product_attribute_value(product_id,attribute_id,value_text)
              VALUES(:product,:attribute,:value)
              ON DUPLICATE KEY UPDATE value_text=VALUES(value_text),option_ids=NULL
              """).param("product",productId).param("attribute",attributeId).param("value",value).update();
        }
    }

    private String digest(String value) {
        try { return java.util.HexFormat.of().withUpperCase().formatHex(MessageDigest.getInstance("MD5")
            .digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception error) { throw new IllegalStateException("生成属性编码失败",error); }
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
