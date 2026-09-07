package cn.govproc.supplychain.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class MiniappsClient {
    private final RestClient http;
    private final ObjectMapper mapper;
    private final String apiId;
    private final String secret;

    public MiniappsClient(ObjectMapper mapper,
        @Value("${app.miniapps.base-url:https://main.miniappss.com/terminal}") String baseUrl,
        @Value("${app.miniapps.api-id:}") String apiId,
        @Value("${app.miniapps.secret:}") String secret) {
        this.mapper = mapper;
        this.http = RestClient.builder().baseUrl(baseUrl.replaceAll("/+$", "")).build();
        this.apiId = apiId.trim();
        this.secret = secret.trim();
    }

    public JsonNode goodsPage(int page, int pageSize) {
        var data = new LinkedHashMap<String,Object>();
        data.put("time", Instant.now().getEpochSecond());
        data.put("page", page);
        data.put("page_size", pageSize);
        data.put("sort", "add_time");
        data.put("sort_type", "desc");
        return call("/api.goods/getGoodsList", data).path("data");
    }

    public JsonNode goodsDetail(long sku, int library) {
        var data = new LinkedHashMap<String,Object>();
        data.put("time", Instant.now().getEpochSecond());
        data.put("sku", sku);
        data.put("library", library);
        data.put("queryExts", "attribute,swiper");
        return call("/api.goods/getGoodsInfo", data).path("data");
    }

    public List<JsonNode> messages() {
        var data = new LinkedHashMap<String,Object>();
        data.put("time", Instant.now().getEpochSecond());
        data.put("type_list", List.of(1,2,3,4));
        JsonNode list = call("/api.message/getMsgList", data).path("data").path("list");
        var result = new ArrayList<JsonNode>();
        if (list.isArray()) list.forEach(result::add);
        return result;
    }

    public void deleteMessages(List<Long> ids) {
        if (ids.isEmpty()) return;
        var data = new LinkedHashMap<String,Object>();
        data.put("time", Instant.now().getEpochSecond());
        data.put("msg_list", ids);
        call("/api.message/delMsg", data);
    }

    JsonNode call(String path, Map<String,Object> data) {
        configured();
        var body = new LinkedHashMap<String,Object>();
        body.put("api_id", apiId);
        body.put("sign", signature(data, secret));
        body.put("data", data);
        JsonNode response = http.post().uri(path).contentType(MediaType.APPLICATION_JSON)
            .body(body).retrieve().body(JsonNode.class);
        if (response == null || response.path("code").asInt() != 200) {
            throw new IllegalStateException("上游接口调用失败：" + (response == null ? "无响应" : response.path("msg").asText("未知错误")));
        }
        return response;
    }

    static String signature(Map<String,Object> data, String key) {
        try {
            List<String> parts = new ArrayList<>();
            data.entrySet().stream().sorted(Comparator.comparing(Map.Entry::getKey))
                .forEach(entry -> append(parts, entry.getKey(), entry.getValue()));
            String source = String.join("&", parts) + "&key=" + key;
            return HexFormat.of().withUpperCase().formatHex(
                MessageDigest.getInstance("MD5").digest(source.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("生成上游接口签名失败", exception);
        }
    }

    private static void append(List<String> parts, String name, Object value) {
        if (value instanceof List<?> list) {
            for (int i=0; i<list.size(); i++) parts.add(name + "[" + i + "]=" + list.get(i));
        } else parts.add(name + "=" + value);
    }

    private void configured() {
        if (apiId.isBlank() || secret.isBlank()) throw new IllegalStateException("未配置上游商城 API 凭据");
    }
}
