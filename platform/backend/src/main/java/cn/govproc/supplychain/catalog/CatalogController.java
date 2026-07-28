package cn.govproc.supplychain.catalog;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/catalog")
public class CatalogController {
    private final JdbcClient jdbc;

    public CatalogController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/categories")
    List<Map<String, Object>> categories() {
        return jdbc.sql("""
            SELECT id, name, parent_id AS parentId, level, sort_order AS sortOrder, icon
            FROM category WHERE status = 1 AND deleted_at IS NULL
            ORDER BY level, sort_order, id
            """).query().listOfRows();
    }

    @GetMapping("/products")
    List<ProductSummary> products(@RequestParam(required = false) Long enterpriseId) {
        return jdbc.sql("""
            SELECT s.id AS sku_id, p.spu_code, s.sku_code, p.title, p.main_image,
                   p.summary, s.market_price, s.member_price, s.stock - s.reserved_stock AS available_stock,
                   ai.agreement_price
            FROM product_sku s
            JOIN product_spu p ON p.id = s.spu_id AND p.deleted_at IS NULL
            LEFT JOIN agreement a ON a.enterprise_id = :enterpriseId AND a.status = 1
                 AND CURRENT_DATE BETWEEN a.effective_date AND a.expiry_date AND a.deleted_at IS NULL
            LEFT JOIN agreement_item ai ON ai.agreement_id = a.id AND ai.sku_id = s.id
                 AND ai.status = 1 AND ai.deleted_at IS NULL
            WHERE p.status = 1 AND s.status = 1 AND s.deleted_at IS NULL
            ORDER BY p.id DESC
            """).param("enterpriseId", enterpriseId).query((rs, n) -> new ProductSummary(
                rs.getLong("sku_id"), rs.getString("spu_code"), rs.getString("sku_code"),
                rs.getString("title"), rs.getString("main_image"), rs.getString("summary"),
                rs.getBigDecimal("market_price"), rs.getBigDecimal("member_price"),
                rs.getBigDecimal("agreement_price"), rs.getInt("available_stock")
            )).list();
    }

    public record ProductSummary(
        long skuId, String spuCode, String skuCode, String title, String mainImage, String summary,
        BigDecimal marketPrice, BigDecimal memberPrice, BigDecimal agreementPrice, int availableStock
    ) {}
}
