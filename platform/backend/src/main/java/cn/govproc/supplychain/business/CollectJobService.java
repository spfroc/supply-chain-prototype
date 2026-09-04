package cn.govproc.supplychain.business;

import cn.govproc.supplychain.common.PageResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.InetAddress;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CollectJobService {
    private static final Logger log = LoggerFactory.getLogger(CollectJobService.class);
    private static final int MAX_BATCH_SIZE = 100;
    private static final int MAX_ATTEMPTS = 4;
    private static final int MAX_BUSY_WAITS = 12;
    private static final String JOB_SQL = """
        SELECT j.id, j.mode, j.platform, j.status,
          j.total_count AS totalCount, j.success_count AS successCount,
          j.fail_count AS failCount, j.skip_count AS skipCount,
          (SELECT COUNT(*) FROM collect_job_item ci WHERE ci.job_id=j.id AND ci.status='CANCELLED') AS cancelledCount,
          (j.success_count + j.fail_count + j.skip_count) AS finishedCount,
          CASE WHEN j.total_count = 0 THEN 0
            ELSE ROUND(100 * (j.success_count + j.fail_count + j.skip_count) / j.total_count) END AS progress,
          j.created_by AS createdBy, j.error_message AS errorMessage,
          DATE_FORMAT(j.started_at,'%Y-%m-%d %H:%i:%s') AS startedAt,
          DATE_FORMAT(j.finished_at,'%Y-%m-%d %H:%i:%s') AS finishedAt,
          DATE_FORMAT(j.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
          DATE_FORMAT(j.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM collect_job j
        """;
    private static final String ITEM_SQL = """
        SELECT i.id, i.job_id AS jobId, i.sort_order AS sortOrder, i.platform, i.url,
          i.member_price AS memberPrice, i.status, i.attempt_count AS attemptCount,
          i.product_id AS productId, i.sku_code AS skuCode, i.title,
          i.error_code AS errorCode, i.error_message AS errorMessage,
          DATE_FORMAT(i.started_at,'%Y-%m-%d %H:%i:%s') AS startedAt,
          DATE_FORMAT(i.finished_at,'%Y-%m-%d %H:%i:%s') AS finishedAt
        FROM collect_job_item i
        """;

    private final JdbcClient jdbc;
    private final RestClient collector;
    private final Executor executor;
    private final TransactionTemplate tx;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String collectorUrl;
    @Value("${app.collect-batch-item-delay-ms:30000}")
    private long batchItemDelayMs;

    public CollectJobService(JdbcClient jdbc, RestClient collectorRestClient,
                             @Qualifier("collectJobExecutor") Executor executor,
                             PlatformTransactionManager transactionManager,
                             @Value("${app.collector-url:}") String collectorUrl) {
        this.jdbc = jdbc;
        this.collector = collectorRestClient;
        this.executor = executor;
        this.tx = new TransactionTemplate(transactionManager);
        this.collectorUrl = collectorUrl == null ? "" : collectorUrl.trim();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void recoverInterruptedJobs() {
        jdbc.sql("UPDATE collect_job_item i JOIN collect_job j ON j.id=i.job_id SET i.status='CANCELLED', i.error_code='cancelled', i.error_message='中止期间服务重启，请核对商品入库结果', i.finished_at=NOW() WHERE j.status='CANCELLING' AND i.status IN ('PENDING','RUNNING')").update();
        jdbc.sql("UPDATE collect_job SET status='CANCELLED', error_message='中止期间服务重启，请核对商品入库结果', finished_at=NOW() WHERE status='CANCELLING'").update();
        int items = jdbc.sql("""
            UPDATE collect_job_item
            SET status='FAILED', error_code='interrupted',
                error_message='采集服务中断，任务未完成，请重新提交',
                finished_at=COALESCE(finished_at, NOW())
            WHERE status IN ('PENDING','RUNNING')
            """).update();
        int jobs = jdbc.sql("""
            UPDATE collect_job
            SET status='FAILED', error_message='采集服务中断，任务未完成，请重新提交',
                finished_at=COALESCE(finished_at, NOW())
            WHERE status IN ('PENDING','RUNNING')
            """).update();
        if (items > 0 || jobs > 0) {
            log.warn("recovered interrupted collect jobs: jobs={}, items={}", jobs, items);
        }
    }

    public Map<String, Object> runSingle(String url, String platform, Double memberPrice,
                                         String authorization, String createdBy) {
        requireCollector(authorization);
        ItemSpec spec = validateItem(url, platform, memberPrice, false);
        Long created = tx.execute(status -> {
            long id = insertJob("SINGLE", spec.platform(), 1, createdBy);
            insertItem(id, 0, spec, "PENDING");
            return id;
        });
        long jobId = java.util.Objects.requireNonNull(created, "未能创建采集任务");
        Map<String, Object> collected = processJob(jobId, authorization);
        Map<String, Object> item = itemsOf(jobId).get(0);
        String status = String.valueOf(item.get("status"));
        if ("SUCCEEDED".equals(status) && collected != null) {
            var result = new LinkedHashMap<>(collected);
            result.put("jobId", jobId);
            return result;
        }
        HttpStatus http = "SKIPPED".equals(status) ? HttpStatus.GONE : HttpStatus.BAD_GATEWAY;
        if ("price_hidden".equals(String.valueOf(item.get("errorCode")))) {
            http = HttpStatus.UNPROCESSABLE_ENTITY;
        } else if ("invalid_url".equals(String.valueOf(item.get("errorCode")))
            || "unsupported_platform".equals(String.valueOf(item.get("errorCode")))
            || "platform_mismatch".equals(String.valueOf(item.get("errorCode")))) {
            http = HttpStatus.BAD_REQUEST;
        }
        throw new ResponseStatusException(http, String.valueOf(item.get("errorMessage")));
    }

    public Map<String, Object> createBatch(List<ItemRequest> items, String platform,
                                           String authorization, String createdBy) {
        requireCollector(authorization);
        if (items == null || items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请至少提交一条商品链接");
        }
        if (items.size() > MAX_BATCH_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单次最多采集 " + MAX_BATCH_SIZE + " 条");
        }
        String requested = normalizePlatform(platform, false);
        List<ItemSpec> specs = new ArrayList<>();
        boolean requirePrice = "jd".equals(requested);
        for (int i = 0; i < items.size(); i++) {
            ItemRequest item = items.get(i);
            try {
                specs.add(validateItem(item == null ? null : item.url(), requested,
                    item == null ? null : item.memberPrice(), requirePrice));
            } catch (ResponseStatusException exception) {
                throw new ResponseStatusException(exception.getStatusCode(),
                    "第 " + (i + 1) + " 条：" + exception.getReason());
            }
        }
        String jobPlatform = specs.stream().map(ItemSpec::platform).distinct().count() == 1
            ? specs.get(0).platform()
            : "mixed";
        Long created = tx.execute(status -> {
            long id = insertJob("BATCH", jobPlatform, specs.size(), createdBy);
            for (int i = 0; i < specs.size(); i++) {
                insertItem(id, i, specs.get(i), "PENDING");
            }
            return id;
        });
        long jobId = java.util.Objects.requireNonNull(created, "未能创建采集任务");
        executor.execute(() -> {
            try {
                processJob(jobId, authorization);
            } catch (Exception exception) {
                log.error("batch collect job {} failed", jobId, exception);
                jdbc.sql("""
                    UPDATE collect_job SET status='FAILED',
                      error_message=:message, finished_at=NOW()
                    WHERE id=:id AND status IN ('PENDING','RUNNING')
                    """).param("id", jobId)
                    .param("message", trim("批量采集中断：" + exception.getMessage(), 500))
                    .update();
            }
        });
        return get(jobId);
    }

    public PageResult<Map<String, Object>> list(int page, int pageSize, String keyword, String status) {
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(100, pageSize));
        var params = new LinkedHashMap<String, Object>();
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        if (keyword != null && !keyword.isBlank()) {
            where.append("""
                 AND (
                  CAST(q.id AS CHAR) LIKE :keyword
                  OR q.platform LIKE :keyword
                  OR IFNULL(q.createdBy,'') LIKE :keyword
                  OR EXISTS (
                    SELECT 1 FROM collect_job_item i
                    WHERE i.job_id=q.id AND i.url LIKE :keyword
                  )
                )
                """);
            params.put("keyword", "%" + keyword.trim() + "%");
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND q.status=:status");
            params.put("status", status.trim().toUpperCase(Locale.ROOT));
        }
        String source = " FROM (" + JOB_SQL + ") q" + where;
        long total = jdbc.sql("SELECT COUNT(*)" + source).params(params).query(Long.class).single();
        params.put("pageLimit", safeSize);
        params.put("pageOffset", (safePage - 1) * (long) safeSize);
        List<Map<String, Object>> records = jdbc.sql(
                "SELECT q.*" + source + " ORDER BY q.id DESC LIMIT :pageLimit OFFSET :pageOffset")
            .params(params).query().listOfRows();
        return new PageResult<>(records, total, safePage, safeSize);
    }

    public Map<String, Object> get(long id) {
        List<Map<String, Object>> jobs = jdbc.sql(JOB_SQL + " WHERE j.id=:id")
            .param("id", id).query().listOfRows();
        if (jobs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "采集任务不存在");
        }
        Map<String, Object> job = new LinkedHashMap<>(jobs.get(0));
        job.put("items", itemsOf(id));
        return job;
    }

    public Map<String, Object> stop(long jobId) {
        Boolean stopped = tx.execute(transaction -> {
            int changed = jdbc.sql("UPDATE collect_job SET status='CANCELLING', error_message='正在中止，等待当前请求完成' WHERE id=:id AND status IN ('PENDING','RUNNING')")
                .param("id", jobId).update();
            if (changed == 0) {
                get(jobId);
                return false;
            }
            jdbc.sql("UPDATE collect_job_item SET status='CANCELLED', error_code='cancelled', error_message='用户中止，未执行', finished_at=NOW() WHERE job_id=:id AND status='PENDING'")
                .param("id", jobId).update();
            return true;
        });
        if (Boolean.TRUE.equals(stopped)) refreshJobProgress(jobId);
        return get(jobId);
    }

    private boolean stopping(long jobId) {
        return jdbc.sql("SELECT COUNT(*) FROM collect_job WHERE id=:id AND status IN ('CANCELLING','CANCELLED')")
            .param("id", jobId).query(Integer.class).single() > 0;
    }

    public Map<String, Object> retryFailed(long jobId, String authorization) {
        requireCollector(authorization);
        Integer claimed = tx.execute(status -> {
            int updated = jdbc.sql("""
                UPDATE collect_job j
                SET status='PENDING', error_message=NULL, started_at=NULL, finished_at=NULL
                WHERE j.id=:id
                  AND j.status NOT IN ('PENDING','RUNNING','CANCELLING')
                  AND EXISTS (
                    SELECT 1 FROM collect_job_item i
                    WHERE i.job_id=j.id AND i.status='FAILED'
                  )
                """).param("id", jobId).update();
            if (updated == 0) {
                return 0;
            }
            jdbc.sql("""
                UPDATE collect_job_item
                SET status='PENDING', attempt_count=0,
                    error_code=NULL, error_message=NULL,
                    product_id=NULL, sku_code=NULL, title=NULL,
                    started_at=NULL, finished_at=NULL
                WHERE job_id=:id AND status='FAILED'
                """).param("id", jobId).update();
            return updated;
        });
        if (claimed == null || claimed == 0) {
            boolean exists = jdbc.sql("SELECT COUNT(*) FROM collect_job WHERE id=:id")
                .param("id", jobId).query(Integer.class).single() > 0;
            if (!exists) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "采集任务不存在");
            }
            String status = jdbc.sql("SELECT status FROM collect_job WHERE id=:id")
                .param("id", jobId).query(String.class).single();
            if ("PENDING".equals(status) || "RUNNING".equals(status) || "CANCELLING".equals(status)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "任务正在执行，请勿重复重试");
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该任务没有可重试的失败项");
        }
        refreshJobProgress(jobId);
        executor.execute(() -> {
            try {
                processJob(jobId, authorization, 3);
            } catch (Exception exception) {
                log.error("retry collect job {} failed", jobId, exception);
                jdbc.sql("""
                    UPDATE collect_job SET status='FAILED',
                      error_message=:message, finished_at=NOW()
                    WHERE id=:id AND status IN ('PENDING','RUNNING')
                    """).param("id", jobId)
                    .param("message", trim("重试采集中断：" + exception.getMessage(), 500))
                    .update();
            }
        });
        return get(jobId);
    }

    Map<String, Object> processJob(long jobId, String authorization) {
        return processJob(jobId, authorization, null);
    }

    private Map<String, Object> processJob(long jobId, String authorization, Integer attemptsOverride) {
        jdbc.sql("""
            UPDATE collect_job SET status='RUNNING', started_at=COALESCE(started_at, NOW())
            WHERE id=:id AND status IN ('PENDING','RUNNING')
            """).param("id", jobId).update();
        List<Map<String, Object>> items = jdbc.sql(ITEM_SQL + " WHERE i.job_id=:id ORDER BY i.sort_order, i.id")
            .param("id", jobId).query().listOfRows();
        String mode = jdbc.sql("SELECT mode FROM collect_job WHERE id=:id")
            .param("id", jobId).query(String.class).single();
        int maxAttempts = attemptsOverride == null
            ? ("BATCH".equals(mode) ? MAX_ATTEMPTS : 1)
            : Math.max(1, attemptsOverride);
        Map<String, Object> lastSuccess = null;
        for (Map<String, Object> item : items) {
            if (stopping(jobId)) break;
            if (!"PENDING".equals(String.valueOf(item.get("status")))) {
                continue;
            }
            Map<String, Object> collected = processItem(jobId, item, authorization, maxAttempts);
            if (collected != null) {
                lastSuccess = collected;
            }
            if (!stopping(jobId) && "BATCH".equals(mode) && batchItemDelayMs > 0) {
                sleepQuietly(Math.min(batchItemDelayMs, 300_000));
            }
        }
        refreshJobProgress(jobId);
        return lastSuccess;
    }

    private Map<String, Object> processItem(long jobId, Map<String, Object> item, String authorization,
                                            int maxAttempts) {
        long itemId = ((Number) item.get("id")).longValue();
        String platform = String.valueOf(item.get("platform"));
        String url = String.valueOf(item.get("url"));
        int claimed = jdbc.sql("""
            UPDATE collect_job_item SET status='RUNNING', started_at=NOW(), error_message=NULL
            WHERE id=:id AND status='PENDING'
            """).param("id", itemId).update();
        if (claimed == 0) return null;
        refreshJobProgress(jobId);

        if ("unknown".equals(platform)) {
            finishItem(itemId, jobId, "FAILED", "unsupported_platform",
                "无法从链接识别平台，请使用京东、淘宝/天猫、徽e采或齐鲁云采商品链接", 0, null);
            return null;
        }

        int attempts = 0;
        int busyWaits = 0;
        String lastCode = "collect_failed";
        String lastMessage = "采集失败";
        while (attempts < maxAttempts) {
            if (stopping(jobId)) {
                finishItem(itemId, jobId, "CANCELLED", "cancelled", "用户中止，不再尝试", attempts, null);
                return null;
            }
            attempts++;
            jdbc.sql("UPDATE collect_job_item SET attempt_count=:n WHERE id=:id")
                .param("n", attempts).param("id", itemId).update();
            try {
                Map<String, Object> result = callCollector(url, platform, priceOf(item), authorization);
                finishItem(itemId, jobId, "SUCCEEDED", null, null, attempts, result);
                return result;
            } catch (CollectCallException exception) {
                lastCode = exception.code;
                lastMessage = exception.message;
                if (exception.outcome == CollectOutcome.SKIP) {
                    finishItem(itemId, jobId, "SKIPPED", lastCode,
                        CollectOutcome.skipReason(lastMessage), attempts, null);
                    return null;
                }
                if (exception.outcome == CollectOutcome.FAIL_NO_RETRY) {
                    finishItem(itemId, jobId, "FAILED", lastCode, lastMessage, attempts, null);
                    return null;
                }
                if (exception.outcome == CollectOutcome.BUSY) {
                    attempts--;
                    busyWaits++;
                    if (busyWaits > MAX_BUSY_WAITS) {
                        finishItem(itemId, jobId, "FAILED", "busy",
                            "采集服务繁忙，等待超时，请稍后在任务列表重试", attempts, null);
                        return null;
                    }
                    sleepQuietly(10_000);
                    continue;
                }
                if (attempts >= maxAttempts) {
                    break;
                }
                sleepQuietly(3_000);
            }
        }
        finishItem(itemId, jobId, "FAILED", lastCode,
            trim(maxAttempts > 1 ? lastMessage + "（已重试3次）" : lastMessage, 1000), attempts, null);
        return null;
    }

    private Map<String, Object> callCollector(String url, String platform, Double memberPrice,
                                              String authorization) {
        var body = new LinkedHashMap<String, Object>();
        body.put("url", url);
        if (platform != null && !platform.isBlank()) {
            body.put("platform", platform);
        }
        if (memberPrice != null && memberPrice > 0) {
            body.put("memberPrice", memberPrice);
        }
        try {
            Map<String, Object> result = collector.post()
                .uri("/collect")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", authorization)
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (result == null) {
                throw new CollectCallException(CollectOutcome.RETRY, "empty", "采集服务未返回结果");
            }
            return result;
        } catch (RestClientResponseException exception) {
            String detail = detailOf(exception);
            int status = exception.getStatusCode().value();
            throw new CollectCallException(CollectOutcome.fromHttp(status, detail), codeOf(detail, status), detail);
        } catch (ResourceAccessException exception) {
            throw new CollectCallException(CollectOutcome.RETRY, "timeout", "采集超时或采集服务不可用");
        }
    }

    private void finishItem(long itemId, long jobId, String status, String errorCode, String errorMessage,
                            int attempts, Map<String, Object> result) {
        jdbc.sql("""
            UPDATE collect_job_item
            SET status=:status, error_code=:errorCode, error_message=:errorMessage,
                attempt_count=:attempts, product_id=:productId, sku_code=:skuCode, title=:title,
                finished_at=NOW()
            WHERE id=:id AND status NOT IN ('CANCELLING','CANCELLED')
            """).param("status", status)
            .param("errorCode", errorCode)
            .param("errorMessage", trim(errorMessage, 1000))
            .param("attempts", attempts)
            .param("productId", result == null ? null : result.get("id"))
            .param("skuCode", result == null ? null : stringOf(result.get("skuCode")))
            .param("title", result == null ? null : trim(stringOf(result.get("title")), 500))
            .param("id", itemId)
            .update();
        refreshJobProgress(jobId);
    }

    private void refreshJobProgress(long jobId) {
        jdbc.sql("""
            UPDATE collect_job j
            SET success_count=(SELECT COUNT(*) FROM collect_job_item i WHERE i.job_id=j.id AND i.status='SUCCEEDED'),
                fail_count=(SELECT COUNT(*) FROM collect_job_item i WHERE i.job_id=j.id AND i.status='FAILED'),
                skip_count=(SELECT COUNT(*) FROM collect_job_item i WHERE i.job_id=j.id AND i.status='SKIPPED'),
                started_at=COALESCE(started_at, NOW())
            WHERE j.id=:id
            """).param("id", jobId).update();
        Map<String, Object> counts = jdbc.sql("""
            SELECT total_count AS totalCount, success_count AS successCount,
              fail_count AS failCount, skip_count AS skipCount
            FROM collect_job WHERE id=:id
            """).param("id", jobId).query().singleRow();
        int pending = jdbc.sql("""
            SELECT COUNT(*) FROM collect_job_item
            WHERE job_id=:id AND status IN ('PENDING','RUNNING')
            """).param("id", jobId).query(Integer.class).single();
        int success = number(counts.get("successCount"));
        int total = number(counts.get("totalCount"));
        String status;
        String error = null;
        if (pending > 0) {
            status = "RUNNING";
        } else if (success == total && total > 0) {
            status = "SUCCEEDED";
        } else if (success > 0) {
            status = "PARTIAL";
        } else {
            status = "FAILED";
            error = "没有成功采集的商品";
        }
        jdbc.sql("""
            UPDATE collect_job
            SET status=:status, error_message=:error,
                finished_at=CASE WHEN :pending=0 THEN NOW() ELSE finished_at END
            WHERE id=:id AND status NOT IN ('CANCELLING','CANCELLED')
            """).param("status", status)
            .param("error", error)
            .param("pending", pending)
            .param("id", jobId)
            .update();
        jdbc.sql("UPDATE collect_job SET status='CANCELLED', error_message='用户已中止；已成功采集的商品保留', finished_at=NOW() WHERE id=:id AND status='CANCELLING' AND NOT EXISTS (SELECT 1 FROM collect_job_item i WHERE i.job_id=:id AND i.status IN ('PENDING','RUNNING'))")
            .param("id", jobId).update();
    }

    private List<Map<String, Object>> itemsOf(long jobId) {
        return jdbc.sql(ITEM_SQL + " WHERE i.job_id=:id ORDER BY i.sort_order, i.id")
            .param("id", jobId).query().listOfRows();
    }

    private long insertJob(String mode, String platform, int total, String createdBy) {
        jdbc.sql("""
            INSERT INTO collect_job(mode, platform, status, total_count, created_by)
            VALUES(:mode, :platform, 'PENDING', :total, :createdBy)
            """).param("mode", mode)
            .param("platform", platform)
            .param("total", total)
            .param("createdBy", createdBy)
            .update();
        return jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
    }

    private void insertItem(long jobId, int sortOrder, ItemSpec spec, String status) {
        jdbc.sql("""
            INSERT INTO collect_job_item(job_id, sort_order, platform, url, member_price, status)
            VALUES(:jobId, :sortOrder, :platform, :url, :price, :status)
            """).param("jobId", jobId)
            .param("sortOrder", sortOrder)
            .param("platform", spec.platform())
            .param("url", spec.url())
            .param("price", spec.memberPrice())
            .param("status", status)
            .update();
    }

    private ItemSpec validateItem(String rawUrl, String requestedPlatform, Double memberPrice, boolean requirePrice) {
        String url = rawUrl == null ? "" : rawUrl.trim();
        if (url.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写商品链接");
        }
        if (url.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "商品链接过长");
        }
        String detected = detectPlatform(url);
        String requested = normalizePlatform(requestedPlatform, true);
        String platform;
        if (requested != null) {
            if (detected != null && !"unknown".equals(detected) && !detected.equals(requested)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "选择的平台与商品链接不一致");
            }
            platform = requested;
        } else if (detected == null || "unknown".equals(detected)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无法从链接识别平台，请选择京东、徽e采或齐鲁云采");
        } else {
            platform = detected;
        }
        if (requirePrice && (memberPrice == null || memberPrice <= 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写对应售价");
        }
        if ("qilu".equals(platform)) {
            String lower = url.toLowerCase(Locale.ROOT);
            if (!lower.contains("goodspriceguid") && !lower.contains("goodsdetail")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "请粘贴齐鲁云采商品详情链接（含 goodspriceguid），不要使用入围商品库列表页");
            }
        }
        if ("huiecai".equals(platform) && !url.toLowerCase(Locale.ROOT).contains("goodsinfo")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "请粘贴徽e采商品详情链接，例如 http://hwly.miniappss.com/goodsInfo/84395.html");
        }
        return new ItemSpec(url, platform, memberPrice != null && memberPrice > 0 ? memberPrice : null);
    }

    static String detectPlatform(String url) {
        String host = hostOf(url);
        String path = pathOf(url);
        String query = queryOf(url);
        if (host.endsWith("jd.com") || host.equals("jd.com")) {
            return "jd";
        }
        if (host.endsWith("taobao.com") || host.endsWith("tmall.com") || host.endsWith("tmall.hk")) {
            return "taobao";
        }
        if (host.endsWith("miniappss.com") || host.endsWith("huiecai.com")
            || (path.contains("goodsinfo/") && isPublicHost(host))) {
            return "huiecai";
        }
        if (host.endsWith("shandong.gov.cn")
            || (isPublicHost(host) && (path.contains("gpfa-main-web")
                || path.contains("goodslibrary")
                || path.contains("scshortlistedgoodslibrary")
                || query.contains("goodspriceguid")))) {
            return "qilu";
        }
        if (url != null && url.trim().matches("\\d{6,}")) {
            return "jd";
        }
        return "unknown";
    }

    private static String pathOf(String url) {
        try {
            URI uri = URI.create(url.contains("://") ? url : "https://" + url);
            String path = uri.getPath();
            return path == null ? "" : path.toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String queryOf(String url) {
        try {
            URI uri = URI.create(url.contains("://") ? url : "https://" + url);
            String query = uri.getQuery();
            return query == null ? "" : query.toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String hostOf(String url) {
        try {
            URI uri = URI.create(url.contains("://") ? url : "https://" + url);
            String host = uri.getHost();
            return host == null ? "" : host.toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {
            return "";
        }
    }

    /** Path/query heuristics must not classify loopback / link-local / private hosts. */
    static boolean isPublicHost(String host) {
        if (host == null || host.isBlank()) {
            return false;
        }
        try {
            InetAddress address = InetAddress.getByName(host);
            return !(address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress());
        } catch (Exception ignored) {
            // Non-resolvable hostnames are still allowed for known public domains.
            return !host.matches("\\d{1,3}(?:\\.\\d{1,3}){3}");
        }
    }

    private static String normalizePlatform(String platform, boolean allowBlank) {
        String value = platform == null ? "" : platform.trim().toLowerCase(Locale.ROOT);
        if (value.isBlank()) {
            if (allowBlank) {
                return null;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择采集平台");
        }
        if (!value.equals("jd") && !value.equals("taobao")
            && !value.equals("huiecai") && !value.equals("qilu")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的平台：" + platform);
        }
        return value;
    }

    private void requireCollector(String authorization) {
        if (collectorUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "采集服务未配置");
        }
        if (authorization == null || authorization.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录后再采集");
        }
    }

    private String detailOf(RestClientResponseException exception) {
        try {
            JsonNode node = mapper.readTree(exception.getResponseBodyAsByteArray());
            if (node != null && node.hasNonNull("detail")) {
                JsonNode detail = node.get("detail");
                return detail.isTextual() ? detail.asText() : detail.toString();
            }
        } catch (Exception ignored) {
            // fall through
        }
        String body = exception.getResponseBodyAsString();
        return body == null || body.isBlank() ? "采集失败" : body;
    }

    private static String codeOf(String detail, int status) {
        if (status == 410 || CollectOutcome.fromHttp(status, detail) == CollectOutcome.SKIP) {
            return "delisted";
        }
        if (detail != null && detail.contains("隐藏了售价")) {
            return "price_hidden";
        }
        if (status == 401) {
            return "unauthorized";
        }
        if (status == 429) {
            return "busy";
        }
        return "collect_failed";
    }

    private static Double priceOf(Map<String, Object> item) {
        Object value = item.get("memberPrice");
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.doubleValue();
        }
        return null;
    }

    private static String stringOf(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("采集任务被中断", exception);
        }
    }

    public record ItemRequest(String url, Double memberPrice) {}

    private record ItemSpec(String url, String platform, Double memberPrice) {}

    private static final class CollectCallException extends RuntimeException {
        private final CollectOutcome outcome;
        private final String code;
        private final String message;

        private CollectCallException(CollectOutcome outcome, String code, String message) {
            super(message);
            this.outcome = outcome;
            this.code = code;
            this.message = message == null || message.isBlank() ? "采集失败" : message;
        }
    }
}
