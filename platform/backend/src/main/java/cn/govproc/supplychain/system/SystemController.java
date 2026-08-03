package cn.govproc.supplychain.system;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
public class SystemController {
    private final JdbcClient jdbc;

    public SystemController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/config")
    Map<String, String> publicConfig() {
        var result = new LinkedHashMap<String, String>();
        jdbc.sql("""
                SELECT config_key, config_value
                FROM system_config
                WHERE is_public = 1
                ORDER BY id
                """)
            .query((rs, rowNum) -> Map.entry(rs.getString("config_key"), rs.getString("config_value")))
            .list()
            .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result;
    }

    @GetMapping("/status")
    Map<String, Object> status() {
        Integer database = jdbc.sql("SELECT 1").query(Integer.class).single();
        return Map.of(
            "service", "政企采购供应链平台",
            "status", "UP",
            "version", "0.1.0",
            "time", OffsetDateTime.now(ZoneId.of("Asia/Shanghai")).toString(),
            "components", Map.of("api", "UP", "database", database == 1 ? "UP" : "DOWN")
        );
    }
}
