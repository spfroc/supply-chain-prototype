package cn.govproc.supplychain.content;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.common.RichTextSanitizer;

@RestController
@RequestMapping("/api/public/portal")
public class PortalController {
    private final JdbcClient jdbc;
    private final ClientAuthService auth;
    private final RichTextSanitizer richTextSanitizer;

    public PortalController(JdbcClient jdbc, ClientAuthService auth, RichTextSanitizer richTextSanitizer) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.richTextSanitizer = richTextSanitizer;
    }

    @GetMapping
    Map<String, Object> portal() {
        var result = new LinkedHashMap<String, Object>();
        for (String type : List.of("NAVIGATION", "BANNER", "PLATFORM", "SOLUTION", "CONTENT")) {
            var rows = jdbc.sql("""
                SELECT id,title,subtitle,description,price_prefix AS pricePrefix,image_url AS imageUrl,mobile_image_url AS mobileImageUrl,
                       link_url AS linkUrl,sort_order AS sortOrder
                FROM portal_resource
                WHERE resource_type=:type AND status=1 AND deleted_at IS NULL
                ORDER BY sort_order,id
                """).param("type", type).query().listOfRows();
            result.put(type.toLowerCase(), "CONTENT".equals(type)
                ? richTextSanitizer.cleanRows(rows, "description") : rows);
        }
        result.put("brands", jdbc.sql("""
            SELECT id,name,logo,description FROM brand
            WHERE status=1 AND deleted_at IS NULL ORDER BY sort_order,id
            """).query().listOfRows());
        result.put("helpLinks",jdbc.sql("""
            SELECT h.id,h.title,h.icon,h.sort_order AS sortOrder,a.id AS articleId,
              CONCAT('/web/articles/',a.id) AS linkUrl
            FROM portal_help_link h JOIN portal_resource a ON a.id=h.article_id
              AND a.resource_type='CONTENT' AND a.status=1 AND a.deleted_at IS NULL
            WHERE h.status=1 AND h.deleted_at IS NULL ORDER BY h.sort_order,h.id
            """).query().listOfRows());
        result.put("footerLinks",jdbc.sql("""
            SELECT id,link_group AS linkGroup,title,link_url AS linkUrl,open_target AS openTarget,sort_order AS sortOrder
            FROM portal_footer_link WHERE status=1 AND deleted_at IS NULL ORDER BY link_group,sort_order,id
            """).query().listOfRows());
        result.put("serviceFeatures",jdbc.sql("""
            SELECT id,image_url AS imageUrl,title,subtitle,sort_order AS sortOrder
            FROM portal_service_feature
            WHERE status=1 AND deleted_at IS NULL ORDER BY sort_order,id
            """).query().listOfRows());
        result.put("floors", jdbc.sql("""
            SELECT f.id,f.title,f.subtitle,f.content_type AS contentType,f.selection_rule AS selectionRule,
                   f.reference_id AS referenceId,f.display_count AS displayCount,f.target_scope AS targetScope,
                   f.link_url AS linkUrl,f.sort_order AS sortOrder,
                   (SELECT GROUP_CONCAT(i.content_id ORDER BY i.sort_order,i.id SEPARATOR ',')
                    FROM home_floor_item i WHERE i.floor_id=f.id AND i.deleted_at IS NULL) AS contentIds
            FROM home_floor f WHERE f.status=1 AND f.deleted_at IS NULL ORDER BY f.sort_order,f.id
            """).query().listOfRows());
        result.put("adGroups",jdbc.sql("""
            SELECT g.id,g.name,g.layout_type AS layoutType,g.placement,g.anchor_floor_id AS anchorFloorId,
              g.target_scope AS targetScope,g.sort_order AS sortOrder,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT('id',x.id,'title',x.title,'webImageUrl',x.web_image_url,
                'h5ImageUrl',x.h5_image_url,'linkUrl',x.link_url,'openTarget',x.open_target,'sortOrder',x.sort_order))
               FROM home_ad_item x WHERE x.group_id=g.id AND x.status=1 AND x.deleted_at IS NULL) AS items
            FROM home_ad_group g WHERE g.status=1 AND g.deleted_at IS NULL
              AND (g.starts_at IS NULL OR g.starts_at<=NOW()) AND (g.ends_at IS NULL OR g.ends_at>=NOW())
            ORDER BY g.sort_order,g.id
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
                   si.required_item AS requiredItem,si.sort_order AS sortOrder,
                   COALESCE(sales.soldCount,0) AS soldCount
            FROM solution_item si
            JOIN product_sku s ON s.id=si.sku_id AND s.status=1 AND s.deleted_at IS NULL
            JOIN product_spu p ON p.id=s.spu_id AND p.status=1 AND p.deleted_at IS NULL
            LEFT JOIN (
                SELECT oi.sku_id,SUM(oi.quantity-oi.refunded_quantity) AS soldCount
                FROM order_item oi JOIN order_main o ON o.id=oi.order_main_id
                WHERE o.payment_status=2 AND o.order_status<>4 AND o.refund_status<>1 AND oi.quantity>oi.refunded_quantity
                GROUP BY oi.sku_id
            ) sales ON sales.sku_id=s.id
            WHERE si.solution_id=:solutionId AND si.deleted_at IS NULL
            ORDER BY si.sort_order,si.id
            """).param("solutionId", solutionId).query().listOfRows();
        return Map.of("solution", solutions.getFirst(), "products", items);
    }

    @GetMapping("/platforms/{platformId}/products")
    Map<String, Object> platformProducts(@PathVariable long platformId) {
        Long enterpriseId=auth.optionalCurrent().map(ClientAuthService.CurrentUser::enterpriseId).orElse(null);
        var platforms=jdbc.sql("""
            SELECT id,title,subtitle,price_prefix AS pricePrefix FROM portal_resource
            WHERE id=:id AND resource_type='PLATFORM' AND status=1 AND deleted_at IS NULL
            """).param("id",platformId).query().listOfRows();
        if(platforms.isEmpty()) throw new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.NOT_FOUND,"平台不存在");
        var platform=platforms.getFirst();
        var products=jdbc.sql("""
            SELECT pp.id AS relationId,pp.sku_id AS skuId,p.id,p.title,p.main_image AS mainImage,p.summary,p.self_operated AS selfOperated,
                   p.badge_type AS badgeType,p.custom_badge AS customBadge,badge_platform.price_prefix AS badgePlatformPrefix,
                   COALESCE((SELECT JSON_ARRAYAGG(o.label) FROM product_service_option pso JOIN system_option o ON o.id=pso.option_id AND o.status=1 AND o.deleted_at IS NULL WHERE pso.product_id=p.id),JSON_ARRAY()) AS services,
                   s.sku_code AS skuCode,s.market_price AS marketPrice,s.member_price AS memberPrice,ai.agreement_price AS agreementPrice,
                   s.stock-s.reserved_stock AS availableStock,pp.platform_price AS platformPrice,
                   pp.product_url AS productUrl,pp.click_count AS clickCount
                   ,COALESCE(sales.soldCount,0) AS soldCount
            FROM product_platform pp
            JOIN product_sku s ON s.id=pp.sku_id AND s.status=1 AND s.deleted_at IS NULL
            JOIN product_spu p ON p.id=s.spu_id AND p.status=1 AND p.deleted_at IS NULL
            LEFT JOIN portal_resource badge_platform ON badge_platform.id=p.badge_platform_id
              AND badge_platform.resource_type='PLATFORM' AND badge_platform.status=1 AND badge_platform.deleted_at IS NULL
            LEFT JOIN agreement a ON a.enterprise_id=:enterpriseId AND a.status=1
              AND CURRENT_DATE BETWEEN a.effective_date AND a.expiry_date AND a.deleted_at IS NULL
            LEFT JOIN agreement_item ai ON ai.agreement_id=a.id AND ai.sku_id=s.id AND ai.status=1 AND ai.deleted_at IS NULL
            LEFT JOIN (
                SELECT oi.sku_id,SUM(oi.quantity-oi.refunded_quantity) AS soldCount
                FROM order_item oi JOIN order_main o ON o.id=oi.order_main_id
                WHERE o.payment_status=2 AND o.order_status<>4 AND o.refund_status<>1 AND oi.quantity>oi.refunded_quantity
                GROUP BY oi.sku_id
            ) sales ON sales.sku_id=s.id
            WHERE pp.platform_id=:platformId AND pp.listing_status=1 AND pp.deleted_at IS NULL
            ORDER BY pp.id DESC
            """).param("platformId",platformId).param("enterpriseId",enterpriseId).query().listOfRows();
        return Map.of("platform",platform,"products",products);
    }

    @PostMapping("/platforms/{platformId}/products/{relationId}/click")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    void recordPlatformProductClick(@PathVariable long platformId, @PathVariable long relationId) {
        int changed = jdbc.sql("""
            UPDATE product_platform pp
            JOIN portal_resource pr ON pr.id=pp.platform_id
              AND pr.resource_type='PLATFORM' AND pr.status=1 AND pr.deleted_at IS NULL
            SET pp.click_count=pp.click_count+1
            WHERE pp.id=:relationId AND pp.platform_id=:platformId
              AND pp.listing_status=1 AND pp.deleted_at IS NULL
            """).param("relationId", relationId).param("platformId", platformId).update();
        if (changed == 0) throw new org.springframework.web.server.ResponseStatusException(
            HttpStatus.NOT_FOUND, "平台商品不存在或已下架");
    }
}
