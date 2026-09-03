package cn.govproc.supplychain.catalog;

import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.common.RichTextSanitizer;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/catalog")
public class CatalogController {
    private final JdbcClient jdbc;
    private final ClientAuthService auth;
    private final RichTextSanitizer richTextSanitizer;

    public CatalogController(JdbcClient jdbc,ClientAuthService auth,RichTextSanitizer richTextSanitizer) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.richTextSanitizer = richTextSanitizer;
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
    List<ProductSummary> products() {
        Long enterpriseId=auth.optionalCurrent().map(ClientAuthService.CurrentUser::enterpriseId).orElse(null);
        return jdbc.sql("""
            SELECT p.id AS product_id,s.id AS sku_id, p.spu_code, s.sku_code, p.title,p.model, COALESCE(NULLIF(s.sku_image,''),p.main_image) AS main_image,p.category_id,p.self_operated,
                   b.id AS brand_id,b.name AS brand_name,
                   JSON_UNQUOTE(JSON_EXTRACT(p.gallery_json,'$.content')) AS gallery,
                   JSON_UNQUOTE(JSON_EXTRACT(p.attributes_json,'$.content')) AS attributes,
                   p.summary,p.detail_html,p.delivery_description,p.after_sales_html,p.badge_type,p.custom_badge,
                   COALESCE((SELECT JSON_ARRAYAGG(o.label) FROM product_service_option pso JOIN system_option o ON o.id=pso.option_id AND o.status=1 AND o.deleted_at IS NULL WHERE pso.product_id=p.id),JSON_ARRAY()) AS services,
                   badge_platform.price_prefix AS badge_platform_prefix,
                   s.market_price, s.member_price, s.stock - s.reserved_stock AS available_stock,
                   ai.agreement_price,COALESCE(sales.sold_count,0) AS sold_count,
                   COALESCE((SELECT SUM(pp.click_count) FROM product_platform pp WHERE pp.sku_id=s.id AND pp.deleted_at IS NULL),0) AS click_count,
                   COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT(
                     'platformId',pp.platform_id,'platformTitle',pr.title,'pricePrefix',pr.price_prefix,
                     'platformPrice',pp.platform_price,'sortOrder',pr.sort_order))
                     FROM product_platform pp
                     JOIN product_sku ps ON ps.id=pp.sku_id AND ps.status=1 AND ps.deleted_at IS NULL
                     JOIN portal_resource pr ON pr.id=pp.platform_id AND pr.resource_type='PLATFORM'
                       AND pr.status=1 AND pr.deleted_at IS NULL
                     WHERE ps.spu_id=p.id AND pp.listing_status=1 AND pp.deleted_at IS NULL),JSON_ARRAY()) AS platform_prices,
                   COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id',ad.id,'code',ad.code,'name',ad.name,'groupName',ad.group_name,
                     'value',pav.value_text,'unit',ad.unit,'filterable',ad.filterable,'searchable',ad.searchable,'sortOrder',ad.sort_order))
                     FROM product_attribute_value pav JOIN attribute_definition ad ON ad.id=pav.attribute_id
                     WHERE pav.product_id=p.id AND ad.visible_flag=1 AND ad.status=1 AND ad.deleted_at IS NULL),JSON_ARRAY()) AS structured_attributes,
                   COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('skuId',sx.id,'skuCode',sx.sku_code,'skuTitle',sx.title,
                     'specValues',sx.spec_json,'skuImage',COALESCE(NULLIF(sx.sku_image,''),p.main_image),
                     'marketPrice',sx.market_price,'memberPrice',sx.member_price,
                     'agreementPrice',(SELECT aix.agreement_price FROM agreement_item aix
                       WHERE aix.agreement_id=a.id AND aix.sku_id=sx.id AND aix.status=1 AND aix.deleted_at IS NULL LIMIT 1),
                     'availableStock',sx.stock-sx.reserved_stock,'status',sx.status))
                     FROM product_sku sx WHERE sx.spu_id=p.id AND sx.status=1 AND sx.deleted_at IS NULL),JSON_ARRAY()) AS variants,
                   (SELECT GROUP_CONCAT(DISTINCT pr.title ORDER BY pr.sort_order,pr.id SEPARATOR '、')
                    FROM product_platform pp
                    JOIN portal_resource pr ON pr.id=pp.platform_id AND pr.resource_type='PLATFORM'
                      AND pr.status=1 AND pr.deleted_at IS NULL
                    WHERE pp.sku_id=s.id AND pp.listing_status=1 AND pp.deleted_at IS NULL) AS platform_names
            FROM product_sku s
            JOIN product_spu p ON p.id = s.spu_id AND p.deleted_at IS NULL
            LEFT JOIN brand b ON b.id=p.brand_id AND b.status=1 AND b.deleted_at IS NULL
            LEFT JOIN portal_resource badge_platform ON badge_platform.id=p.badge_platform_id
              AND badge_platform.resource_type='PLATFORM' AND badge_platform.status=1 AND badge_platform.deleted_at IS NULL
            LEFT JOIN agreement a ON a.enterprise_id = :enterpriseId AND a.status = 1
                 AND CURRENT_DATE BETWEEN a.effective_date AND a.expiry_date AND a.deleted_at IS NULL
            LEFT JOIN agreement_item ai ON ai.agreement_id = a.id AND ai.sku_id = s.id
                 AND ai.status = 1 AND ai.deleted_at IS NULL
            LEFT JOIN (
                SELECT soldsku.spu_id,SUM(oi.quantity) AS sold_count
                FROM order_item oi JOIN product_sku soldsku ON soldsku.id=oi.sku_id JOIN order_main o ON o.id=oi.order_main_id
                WHERE o.payment_status=2 AND o.order_status<>4 AND o.refund_status=0
                GROUP BY soldsku.spu_id
            ) sales ON sales.spu_id=p.id
            WHERE p.status = 1 AND s.status = 1 AND s.deleted_at IS NULL
              AND s.id=(SELECT MIN(s0.id) FROM product_sku s0 WHERE s0.spu_id=p.id AND s0.status=1 AND s0.deleted_at IS NULL)
            ORDER BY p.id DESC
            """).param("enterpriseId", enterpriseId).query((rs, n) -> new ProductSummary(
                rs.getLong("product_id"),rs.getLong("sku_id"), rs.getString("spu_code"), rs.getString("sku_code"),
                rs.getString("title"),rs.getString("model"), rs.getString("main_image"),rs.getString("gallery"),
                rs.getString("attributes"),rs.getString("summary"),richTextSanitizer.clean(rs.getString("detail_html")),
                rs.getString("delivery_description"),richTextSanitizer.clean(rs.getString("after_sales_html")),rs.getLong("category_id"),rs.getInt("self_operated"),rs.getLong("brand_id"),rs.getString("brand_name"),
                rs.getBigDecimal("market_price"), rs.getBigDecimal("member_price"),
                rs.getBigDecimal("agreement_price"), rs.getInt("available_stock"),rs.getLong("sold_count"),rs.getLong("click_count"),rs.getString("structured_attributes"),rs.getString("platform_names"),rs.getString("platform_prices"),rs.getString("variants"),
                rs.getString("badge_type"),rs.getString("custom_badge"),rs.getString("badge_platform_prefix"),rs.getString("services")
            )).list();
    }

    public record ProductSummary(
        long id,long skuId, String spuCode, String skuCode, String title,String model, String mainImage,String gallery,
        String attributes,String summary,String detailHtml,String deliveryDescription,String afterSalesHtml,long categoryId,int selfOperated,long brandId,String brandName,
        BigDecimal marketPrice, BigDecimal memberPrice, BigDecimal agreementPrice, int availableStock,long soldCount,long clickCount,String structuredAttributes,String platformNames,String platformPrices,String variants,
        String badgeType,String customBadge,String badgePlatformPrefix,String services
    ) {}
}
