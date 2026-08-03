package cn.govproc.supplychain.content;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

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
                SELECT id,title,subtitle,description,image_url AS imageUrl,mobile_image_url AS mobileImageUrl,
                       link_url AS linkUrl,sort_order AS sortOrder
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

    @GetMapping("/solutions/{solutionId}")
    Map<String, Object> solution(@PathVariable long solutionId) {
        var solutions = jdbc.sql("""
            SELECT id,title,subtitle,description,image_url AS imageUrl,mobile_image_url AS mobileImageUrl,
                   sort_order AS sortOrder
            FROM portal_resource
            WHERE id=:id AND resource_type='SOLUTION' AND status=1 AND deleted_at IS NULL
            """).param("id", solutionId).query().listOfRows();
        if (solutions.isEmpty()) throw new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.NOT_FOUND, "方案不存在或未发布");
        var items = jdbc.sql("""
            SELECT si.id AS relationId,si.sku_id AS skuId,p.title,
                   COALESCE(NULLIF(p.main_image,''),SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(p.gallery_json,'$.content')),'\n',1)) AS mainImage,
                   p.summary,
                   s.sku_code AS skuCode,s.market_price AS marketPrice,s.member_price AS memberPrice,
                   s.stock-s.reserved_stock AS availableStock,si.default_quantity AS defaultQuantity,
                   si.required_item AS requiredItem,si.sort_order AS sortOrder
            FROM solution_item si
            JOIN product_sku s ON s.id=si.sku_id AND s.status=1 AND s.deleted_at IS NULL
            JOIN product_spu p ON p.id=s.spu_id AND p.status=1 AND p.deleted_at IS NULL
            WHERE si.solution_id=:solutionId AND si.deleted_at IS NULL
            ORDER BY si.sort_order,si.id
            """).param("solutionId", solutionId).query().listOfRows();
        return Map.of("solution", solutions.getFirst(), "products", items);
    }

    @GetMapping("/platforms/{platformId}/products")
    Map<String, Object> platformProducts(@PathVariable long platformId) {
        var platforms=jdbc.sql("""
            SELECT id,title,subtitle FROM portal_resource
            WHERE id=:id AND resource_type='PLATFORM' AND status=1 AND deleted_at IS NULL
            """).param("id",platformId).query().listOfRows();
        if(platforms.isEmpty()) throw new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.NOT_FOUND,"平台不存在");
        var platform=platforms.getFirst();
        var products=jdbc.sql("""
            SELECT pp.id AS relationId,pp.sku_id AS skuId,p.title,p.main_image AS mainImage,p.summary,
                   s.sku_code AS skuCode,s.market_price AS marketPrice,s.member_price AS memberPrice,
                   s.stock-s.reserved_stock AS availableStock,pp.platform_price AS platformPrice,
                   pp.product_url AS productUrl,pp.click_count AS clickCount
            FROM product_platform pp
            JOIN product_sku s ON s.id=pp.sku_id AND s.status=1 AND s.deleted_at IS NULL
            JOIN product_spu p ON p.id=s.spu_id AND p.status=1 AND p.deleted_at IS NULL
            WHERE pp.platform_id=:platformId AND pp.listing_status=1 AND pp.deleted_at IS NULL
            ORDER BY pp.id DESC
            """).param("platformId",platformId).query().listOfRows();
        return Map.of("platform",platform,"products",products);
    }
}
