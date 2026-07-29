package cn.govproc.supplychain.content;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/portal")
public class PortalController {
    private final JdbcClient jdbc;

    public PortalController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    Map<String, Object> portal() {
        var result = new LinkedHashMap<String, Object>();
        for (String type : List.of("NAVIGATION", "BANNER", "PLATFORM", "SOLUTION", "CONTENT")) {
            result.put(type.toLowerCase(), jdbc.sql("""
                SELECT id,title,subtitle,image_url AS imageUrl,link_url AS linkUrl,sort_order AS sortOrder
                FROM portal_resource
                WHERE resource_type=:type AND status=1 AND deleted_at IS NULL
                ORDER BY sort_order,id
                """).param("type", type).query().listOfRows());
        }
        result.put("brands", jdbc.sql("""
            SELECT id,name,logo,description FROM brand
            WHERE status=1 AND deleted_at IS NULL ORDER BY sort_order,id
            """).query().listOfRows());
        return result;
    }
}
