package cn.govproc.supplychain.business;

import cn.govproc.supplychain.common.PageSupport;
import cn.govproc.supplychain.common.RichTextSanitizer;
import cn.govproc.supplychain.order.OrderInventoryService;
import cn.govproc.supplychain.order.OrderStatePolicy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.security.SecureRandom;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/business")
public class AdminBusinessController {
    private static final SecureRandom CODE_RANDOM = new SecureRandom();
    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final OrderInventoryService inventory;
    private final RichTextSanitizer richTextSanitizer;
    public AdminBusinessController(JdbcClient jdbc,PasswordEncoder encoder,OrderInventoryService inventory,
                                   RichTextSanitizer richTextSanitizer) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.inventory = inventory;
        this.richTextSanitizer = richTextSanitizer;
    }

    @GetMapping("/products")
    Object products(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                    @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status,
                    @RequestParam(required=false) String badgeType,
                    @RequestParam(required=false) Long categoryId,@RequestParam(required=false) Long brandId,
                    @RequestParam(required=false) Integer selfOperated,
                    @RequestParam(required=false) Integer stockMin,@RequestParam(required=false) Integer stockMax) {
        String base="""
          SELECT p.id,p.spu_code AS spuCode,p.title,p.model,p.summary,p.main_image AS mainImage,p.self_operated AS selfOperated,
            p.badge_type AS badgeType,p.badge_platform_id AS badgePlatformId,p.custom_badge AS customBadge,
            p.collection_platform AS collectionPlatform,p.collection_source_url AS collectionSourceUrl,
            COALESCE((SELECT JSON_ARRAYAGG(pso.option_id) FROM product_service_option pso WHERE pso.product_id=p.id),JSON_ARRAY()) AS serviceOptionIds,
            JSON_UNQUOTE(JSON_EXTRACT(p.gallery_json,'$.content')) AS gallery,
            p.detail_html AS detailHtml,p.delivery_description AS deliveryDescription,
            p.after_sales_html AS afterSalesHtml,p.category_id AS categoryId,p.brand_id AS brandId,
            p.status,s.id AS skuId,s.sku_code AS skuCode,s.market_price AS marketPrice,s.member_price AS memberPrice,
            (SELECT SUM(st.stock) FROM product_sku st WHERE st.spu_id=p.id AND st.deleted_at IS NULL) AS stock,
            (SELECT SUM(st.reserved_stock) FROM product_sku st WHERE st.spu_id=p.id AND st.deleted_at IS NULL) AS reservedStock,
            DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
            DATE_FORMAT(p.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt,
            COALESCE(sales.soldCount,0) AS soldCount,COALESCE(sales.orderCount,0) AS orderCount,
            COALESCE(sales.salesAmount,0) AS salesAmount,
            COALESCE((SELECT GROUP_CONCAT(DISTINCT pr.title ORDER BY pr.title SEPARATOR '、')
              FROM product_platform pp JOIN portal_resource pr ON pr.id=pp.platform_id
                AND pr.resource_type='PLATFORM' AND pr.deleted_at IS NULL
              JOIN product_sku ps ON ps.id=pp.sku_id
              WHERE ps.spu_id=p.id AND pp.deleted_at IS NULL),'') AS platformNames,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id',pp.id,'platformId',pp.platform_id,'skuId',pp.sku_id))
              FROM product_platform pp JOIN product_sku ps ON ps.id=pp.sku_id
              WHERE ps.spu_id=p.id AND pp.deleted_at IS NULL),JSON_ARRAY()) AS platformRelations,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id',ai.id,'agreementId',ai.agreement_id,'skuId',ai.sku_id,
              'agreementPrice',ai.agreement_price,'status',ai.status))
              FROM agreement_item ai JOIN product_sku ags ON ags.id=ai.sku_id
              WHERE ags.spu_id=p.id AND ai.deleted_at IS NULL),JSON_ARRAY()) AS agreementRelations,
            COALESCE((SELECT JSON_OBJECTAGG(CAST(pav.attribute_id AS CHAR),
              CASE WHEN pav.option_ids IS NOT NULL THEN
                CASE WHEN ad.input_type='CHECKBOX' THEN pav.option_ids ELSE JSON_EXTRACT(pav.option_ids,'$[0]') END
                ELSE pav.value_text END)
              FROM product_attribute_value pav JOIN attribute_definition ad ON ad.id=pav.attribute_id
              WHERE pav.product_id=p.id),JSON_OBJECT()) AS attributeValues,
            (SELECT COUNT(*) FROM product_sku sx WHERE sx.spu_id=p.id AND sx.deleted_at IS NULL) AS skuCount,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id',sx.id,'skuCode',sx.sku_code,'skuTitle',sx.title,
              'specValues',sx.spec_json,'skuImage',sx.sku_image,'skuGallery',COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sx.gallery_json,'$.content')),''),'marketPrice',sx.market_price,
              'memberPrice',sx.member_price,'stock',sx.stock,'reservedStock',sx.reserved_stock,'status',sx.status,
              'createdAt',DATE_FORMAT(sx.created_at,'%Y-%m-%d %H:%i:%s'),'updatedAt',DATE_FORMAT(sx.updated_at,'%Y-%m-%d %H:%i:%s')))
              FROM product_sku sx WHERE sx.spu_id=p.id AND sx.deleted_at IS NULL),JSON_ARRAY()) AS skus
          FROM product_spu p JOIN product_sku s ON s.spu_id=p.id AND s.deleted_at IS NULL
            AND s.id=(SELECT MIN(s0.id) FROM product_sku s0 WHERE s0.spu_id=p.id AND s0.deleted_at IS NULL)
          LEFT JOIN (
            SELECT sku.spu_id,SUM(oi.quantity) AS soldCount,COUNT(DISTINCT oi.order_main_id) AS orderCount,
              SUM(oi.total_price) AS salesAmount
            FROM order_item oi JOIN product_sku sku ON sku.id=oi.sku_id JOIN order_main o ON o.id=oi.order_main_id
            WHERE o.payment_status=2 AND o.order_status<>4 AND o.refund_status=0
            GROUP BY sku.spu_id
          ) sales ON sales.spu_id=p.id
          WHERE p.deleted_at IS NULL
          """;
        String normalizedBadgeType=badgeType==null?"":badgeType.trim().toUpperCase();
        var params=new java.util.HashMap<String,Object>();
        if(categoryId!=null) { base+=" AND p.category_id=:categoryId"; params.put("categoryId",categoryId); }
        if(brandId!=null) { base+=" AND p.brand_id=:brandId"; params.put("brandId",brandId); }
        if(selfOperated!=null) {
            if(selfOperated!=0&&selfOperated!=1) throw new IllegalArgumentException("自营筛选条件不正确");
            base+=" AND p.self_operated=:selfOperated"; params.put("selfOperated",selfOperated);
        }
        if(stockMin!=null&&stockMin<0||stockMax!=null&&stockMax<0) throw new IllegalArgumentException("库存区间不能小于0");
        if(stockMin!=null&&stockMax!=null&&stockMin>stockMax) throw new IllegalArgumentException("最低库存不能大于最高库存");
        if(stockMin!=null) {
            base+=" AND (SELECT COALESCE(SUM(st.stock-st.reserved_stock),0) FROM product_sku st WHERE st.spu_id=p.id AND st.deleted_at IS NULL)>=:stockMin";
            params.put("stockMin",stockMin);
        }
        if(stockMax!=null) {
            base+=" AND (SELECT COALESCE(SUM(st.stock-st.reserved_stock),0) FROM product_sku st WHERE st.spu_id=p.id AND st.deleted_at IS NULL)<=:stockMax";
            params.put("stockMax",stockMax);
        }
        if(!normalizedBadgeType.isBlank()) {
            if("AUTO".equals(normalizedBadgeType)) base+=" AND p.badge_type IS NULL";
            else {
                if(!Set.of("AGREEMENT","PLATFORM","CUSTOM").contains(normalizedBadgeType))
                    throw new IllegalArgumentException("角标类型不正确");
                base+=" AND p.badge_type=:badgeType";
                params.put("badgeType",normalizedBadgeType);
            }
        }
        if(keyword!=null&&!keyword.isBlank()) {
            base+="""
              AND (
                p.title LIKE :listKeyword OR p.spu_code LIKE :listKeyword
                OR IFNULL(p.model,'') LIKE :listKeyword OR IFNULL(p.summary,'') LIKE :listKeyword
                OR EXISTS (
                  SELECT 1 FROM product_sku kx
                  WHERE kx.spu_id=p.id AND kx.deleted_at IS NULL
                    AND (kx.sku_code LIKE :listKeyword OR IFNULL(kx.title,'') LIKE :listKeyword)
                )
              )
              """;
            params.put("listKeyword","%"+keyword.trim()+"%");
        }
        if(status!=null) {
            base+=" AND p.status=:listStatus";
            params.put("listStatus",status);
        }
        if(page==null) return richTextSanitizer.cleanRows(
          jdbc.sql(base+" ORDER BY id DESC").params(params).query().listOfRows(), "detailHtml", "afterSalesHtml");
        return richTextSanitizer.cleanPage(
          PageSupport.query(jdbc,base,"q.id DESC",params,page,pageSize,"",null,List.of(),"status"),
          "detailHtml", "afterSalesHtml");
    }

    @GetMapping("/product-associations")
    Object productAssociations(@RequestParam String type,@RequestParam(defaultValue="1") int page,
                               @RequestParam(defaultValue="10") int pageSize,
                               @RequestParam(defaultValue="") String keyword,
                               @RequestParam(required=false) Long targetId,
                               @RequestParam(required=false) Integer status) {
        String normalized=type.trim().toUpperCase();
        String base;
        String relationStatusColumn=null;
        var params=new java.util.HashMap<String,Object>();
        switch(normalized) {
          case "PLATFORM" -> {
            base="""
              SELECT rel.id AS relationId,p.id AS productId,s.id AS skuId,p.title,p.main_image AS mainImage,p.spu_code AS spuCode,
                s.sku_code AS skuCode,s.market_price AS marketPrice,s.member_price AS memberPrice,
                s.stock-s.reserved_stock AS availableStock,p.status AS productStatus,p.self_operated AS selfOperated,
                p.badge_type AS badgeType,p.custom_badge AS customBadge,badge_platform.price_prefix AS badgePlatformPrefix,
                target.id AS targetId,target.title AS associationName,rel.platform_price AS associationPrice,
                rel.product_url AS productUrl,rel.listing_status AS relationStatus,rel.click_count AS clickCount
              FROM product_platform rel JOIN product_sku s ON s.id=rel.sku_id AND s.deleted_at IS NULL
              JOIN product_spu p ON p.id=s.spu_id AND p.deleted_at IS NULL
              LEFT JOIN portal_resource badge_platform ON badge_platform.id=p.badge_platform_id AND badge_platform.deleted_at IS NULL
              JOIN portal_resource target ON target.id=rel.platform_id AND target.resource_type='PLATFORM' AND target.deleted_at IS NULL
              WHERE rel.deleted_at IS NULL
              """;
            relationStatusColumn="relationStatus";
          }
          case "AGREEMENT" -> {
            base="""
              SELECT rel.id AS relationId,p.id AS productId,s.id AS skuId,p.title,p.main_image AS mainImage,p.spu_code AS spuCode,
                s.sku_code AS skuCode,s.market_price AS marketPrice,s.member_price AS memberPrice,
                s.stock-s.reserved_stock AS availableStock,p.status AS productStatus,p.self_operated AS selfOperated,
                p.badge_type AS badgeType,p.custom_badge AS customBadge,badge_platform.price_prefix AS badgePlatformPrefix,
                target.id AS targetId,CONCAT(target.name,'（',owner.name,'）') AS associationName,
                rel.agreement_price AS associationPrice,rel.status AS relationStatus,0 AS clickCount
              FROM agreement_item rel JOIN product_sku s ON s.id=rel.sku_id AND s.deleted_at IS NULL
              JOIN product_spu p ON p.id=s.spu_id AND p.deleted_at IS NULL
              LEFT JOIN portal_resource badge_platform ON badge_platform.id=p.badge_platform_id AND badge_platform.deleted_at IS NULL
              JOIN agreement target ON target.id=rel.agreement_id AND target.deleted_at IS NULL
              JOIN enterprise owner ON owner.id=target.enterprise_id AND owner.deleted_at IS NULL
              WHERE rel.deleted_at IS NULL
              """;
            relationStatusColumn="relationStatus";
          }
          case "SOLUTION" -> {
            base="""
              SELECT rel.id AS relationId,p.id AS productId,s.id AS skuId,p.title,p.main_image AS mainImage,p.spu_code AS spuCode,
                s.sku_code AS skuCode,s.market_price AS marketPrice,s.member_price AS memberPrice,
                s.stock-s.reserved_stock AS availableStock,p.status AS productStatus,p.self_operated AS selfOperated,
                p.badge_type AS badgeType,p.custom_badge AS customBadge,badge_platform.price_prefix AS badgePlatformPrefix,
                target.id AS targetId,target.title AS associationName,s.member_price AS associationPrice,
                rel.default_quantity AS defaultQuantity,rel.required_item AS requiredItem,rel.sort_order AS sortOrder,
                1 AS relationStatus,0 AS clickCount
              FROM solution_item rel JOIN product_sku s ON s.id=rel.sku_id AND s.deleted_at IS NULL
              JOIN product_spu p ON p.id=s.spu_id AND p.deleted_at IS NULL
              LEFT JOIN portal_resource badge_platform ON badge_platform.id=p.badge_platform_id AND badge_platform.deleted_at IS NULL
              JOIN portal_resource target ON target.id=rel.solution_id AND target.resource_type='SOLUTION' AND target.deleted_at IS NULL
              WHERE rel.deleted_at IS NULL
              """;
          }
          default -> throw new IllegalArgumentException("不支持的商品关联类型");
        }
        if(targetId!=null){base+=" AND target.id=:targetId";params.put("targetId",targetId);}
        return PageSupport.query(jdbc,base,"q.productId DESC,q.skuId,q.relationId",params,page,pageSize,keyword,status,
          List.of("title","spuCode","skuCode","associationName"),relationStatusColumn);
    }

    @PostMapping("/products") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String,Object> createProduct(@Valid @RequestBody ProductRequest r) {
        if(value(r.mainImage()).isBlank()||r.marketPrice()==null||r.memberPrice()==null)
            throw new IllegalArgumentException("商品主图、市场价和会员价不能为空");
        validateBadge(null,r);
        String spuCode=uniqueProductCode();
        String skuCode=uniqueProductCode();
        while(skuCode.equals(spuCode)) skuCode=uniqueProductCode();
        jdbc.sql("""
          INSERT INTO product_spu(spu_code,title,model,category_id,brand_id,self_operated,main_image,gallery_json,
            summary,detail_html,delivery_description,after_sales_html,status,badge_type,badge_platform_id,custom_badge,
            collection_platform,collection_source_url)
          VALUES(:code,:title,:model,:categoryId,:brandId,:selfOperated,:mainImage,JSON_OBJECT('content',:gallery),
            :summary,:detailHtml,:deliveryDescription,:afterSalesHtml,:status,:badgeType,:badgePlatformId,:customBadge,
            :collectionPlatform,:collectionSourceUrl)
          """)
          .param("code",spuCode).param("title",r.title()).param("model",value(r.model())).param("categoryId",r.categoryId()).param("brandId",r.brandId())
          .param("selfOperated",r.selfOperatedValue())
          .param("mainImage",value(r.mainImage())).param("gallery",value(r.gallery()))
          .param("summary",value(r.summary())).param("detailHtml",richTextSanitizer.clean(r.detailHtml()))
          .param("deliveryDescription",value(r.deliveryDescription())).param("afterSalesHtml",richTextSanitizer.clean(r.afterSalesHtml()))
          .param("badgeType",persistedBadgeType(r.badgeType())).param("badgePlatformId",normalizedBadgePlatformId(r))
          .param("customBadge",normalizedCustomBadge(r))
          .param("collectionPlatform",normalizedCollectionPlatform(r.collectionPlatform()))
          .param("collectionSourceUrl",normalizedCollectionSourceUrl(r.collectionSourceUrl()))
          .param("status",r.status()).update();
        long id=jdbc.sql("SELECT id FROM product_spu WHERE spu_code=:code").param("code",spuCode).query(Long.class).single();
        saveSkus(id,r,skuCode);
        saveAttributeValues(id,r.attributeValues());
        saveServiceOptions(id,r.serviceOptionIds());
        return Map.of("id",id,"spuCode",spuCode);
    }

    @PutMapping("/products/{id}") @Transactional
    void updateProduct(@PathVariable long id,@Valid @RequestBody ProductRequest r) {
        validateBadge(id,r);
        require(jdbc.sql("""
          UPDATE product_spu SET title=:title,model=:model,category_id=:categoryId,brand_id=:brandId,self_operated=:selfOperated,
          main_image=COALESCE(:mainImage,main_image),
          gallery_json=CASE WHEN :gallery IS NULL THEN gallery_json ELSE JSON_OBJECT('content',:gallery) END,
          attributes_json=NULL,
          summary=COALESCE(:summary,summary),detail_html=COALESCE(:detailHtml,detail_html),
          delivery_description=COALESCE(:deliveryDescription,delivery_description),
          after_sales_html=COALESCE(:afterSalesHtml,after_sales_html),
          badge_type=CASE WHEN :badgeType IS NULL THEN badge_type ELSE NULLIF(:badgeType,'NONE') END,
          badge_platform_id=CASE WHEN :badgeType IS NULL THEN badge_platform_id ELSE :badgePlatformId END,
          custom_badge=CASE WHEN :badgeType IS NULL THEN custom_badge ELSE :customBadge END,
          collection_platform=COALESCE(:collectionPlatform,collection_platform),
          collection_source_url=COALESCE(:collectionSourceUrl,collection_source_url),
          status=:status WHERE id=:id AND deleted_at IS NULL
          """)
          .param("id",id).param("title",r.title()).param("model",value(r.model())).param("categoryId",r.categoryId()).param("brandId",r.brandId())
          .param("selfOperated",r.selfOperatedValue())
          .param("mainImage",r.mainImage()).param("gallery",r.gallery())
          .param("summary",r.summary())
          .param("detailHtml",r.detailHtml()==null?null:richTextSanitizer.clean(r.detailHtml()))
          .param("deliveryDescription",r.deliveryDescription())
          .param("afterSalesHtml",r.afterSalesHtml()==null?null:richTextSanitizer.clean(r.afterSalesHtml()))
          .param("badgeType",r.badgeType()).param("badgePlatformId",normalizedBadgePlatformId(r))
          .param("customBadge",normalizedCustomBadge(r))
          .param("collectionPlatform",normalizedCollectionPlatform(r.collectionPlatform()))
          .param("collectionSourceUrl",normalizedCollectionSourceUrl(r.collectionSourceUrl()))
          .param("status",r.status()).update(),"商品不存在");
        if((r.skus()!=null&&!r.skus().isEmpty())||r.marketPrice()!=null||r.memberPrice()!=null) saveSkus(id,r,null);
        if(r.attributeValues()!=null) saveAttributeValues(id,r.attributeValues());
        if(r.serviceOptionIds()!=null) saveServiceOptions(id,r.serviceOptionIds());
    }

    @GetMapping("/product-service-options")
    List<Map<String,Object>> productServiceOptions() {
        return jdbc.sql("SELECT id,label,option_value AS optionValue,sort_order AS sortOrder FROM system_option WHERE option_type='PRODUCT_SERVICE' AND status=1 AND deleted_at IS NULL ORDER BY sort_order,id")
          .query().listOfRows();
    }

    @GetMapping("/product-badge-options")
    List<Map<String,Object>> productBadgeOptions() {
        return jdbc.sql("SELECT id,label,option_value AS optionValue,sort_order AS sortOrder FROM system_option WHERE option_type='PRODUCT_BADGE' AND status=1 AND deleted_at IS NULL ORDER BY sort_order,id")
          .query().listOfRows();
    }

    @GetMapping("/product-default-stock")
    Map<String,Object> productDefaultStock() {
        int stock=jdbc.sql("SELECT config_value FROM system_config WHERE config_key='inventory.defaultStock'")
          .query(String.class).optional().map(value->{try{return Math.max(0,Integer.parseInt(value));}catch(NumberFormatException e){return 10000;}}).orElse(10000);
        return Map.of("stock",stock);
    }

    @GetMapping("/product-content-templates")
    Map<String,Object> productContentTemplates() {
        var rows=jdbc.sql("SELECT config_key,config_value FROM system_config WHERE config_key IN ('product.deliveryTemplates','product.afterSalesTemplates')")
          .query().listOfRows();
        var result=new java.util.HashMap<String,Object>();
        result.put("deliveryTemplates","[]");
        result.put("afterSalesTemplates","[]");
        rows.forEach(row->{
            String key=String.valueOf(row.get("config_key"));
            result.put(key.endsWith("deliveryTemplates")?"deliveryTemplates":"afterSalesTemplates",row.get("config_value"));
        });
        return result;
    }

    @PutMapping("/products/{id}/status") @Transactional
    void productStatus(@PathVariable long id,@RequestBody StatusRequest r) {
        require(jdbc.sql("UPDATE product_spu SET status=:status WHERE id=:id AND deleted_at IS NULL")
          .params(Map.of("id",id,"status",r.status())).update(),"商品不存在");
        jdbc.sql("UPDATE product_sku SET status=:status WHERE spu_id=:id AND deleted_at IS NULL")
          .params(Map.of("id",id,"status",r.status()==1?1:0)).update();
    }

    @PutMapping("/products/{productId}/skus/{skuId}/status") @Transactional
    void skuStatus(@PathVariable long productId,@PathVariable long skuId,@RequestBody StatusRequest r) {
        if(r.status()!=0&&r.status()!=1) throw new IllegalArgumentException("SKU状态只能为启用或停用");
        require(jdbc.sql("UPDATE product_sku SET status=:status WHERE id=:skuId AND spu_id=:productId AND deleted_at IS NULL")
          .params(Map.of("productId",productId,"skuId",skuId,"status",r.status())).update(),"SKU不存在");
    }

    @PutMapping("/products/batch-self-operated") @Transactional
    Map<String,Object> batchSelfOperated(@RequestBody BatchSelfOperatedRequest r) {
        if(r.ids()==null||r.ids().isEmpty()) throw new IllegalArgumentException("请选择商品");
        if(r.selfOperated()!=0&&r.selfOperated()!=1) throw new IllegalArgumentException("经营类型不正确");
        int changed=jdbc.sql("UPDATE product_spu SET self_operated=:selfOperated WHERE id IN (:ids) AND deleted_at IS NULL")
          .param("selfOperated",r.selfOperated()).param("ids",r.ids()).update();
        return Map.of("updated",changed);
    }

    @PutMapping("/products/{id}/stock") @Transactional
    void productStock(@PathVariable long id,@RequestBody StockRequest r) {
        int reserved=jdbc.sql("SELECT MAX(reserved_stock) FROM product_sku WHERE spu_id=:id AND deleted_at IS NULL")
          .param("id",id).query(Integer.class).optional().orElseThrow(()->new IllegalArgumentException("商品不存在"));
        if(r.stock()<reserved) throw new IllegalArgumentException("库存不能小于已占用库存 "+reserved);
        jdbc.sql("UPDATE product_sku SET stock=:stock WHERE spu_id=:id AND deleted_at IS NULL")
          .params(Map.of("id",id,"stock",r.stock())).update();
    }

    @DeleteMapping("/products/{id}") @Transactional @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteProduct(@PathVariable long id) {
        require(jdbc.sql("UPDATE product_spu SET deleted_at=NOW(),status=2 WHERE id=:id AND deleted_at IS NULL")
          .param("id",id).update(),"商品不存在");
        jdbc.sql("UPDATE product_sku SET deleted_at=NOW(),status=0 WHERE spu_id=:id AND deleted_at IS NULL").param("id",id).update();
    }

    @GetMapping("/categories")
    List<Map<String,Object>> categories() {
        return jdbc.sql("""
          WITH RECURSIVE category_tree AS (
            SELECT id AS ancestor_id,id AS descendant_id FROM category WHERE deleted_at IS NULL
            UNION ALL
            SELECT tree.ancestor_id,child.id
            FROM category_tree tree
            JOIN category child ON child.parent_id=tree.descendant_id AND child.deleted_at IS NULL
          ), product_counts AS (
            SELECT tree.ancestor_id,COUNT(DISTINCT product.id) AS product_count
            FROM category_tree tree
            LEFT JOIN product_spu product ON product.category_id=tree.descendant_id AND product.deleted_at IS NULL
            GROUP BY tree.ancestor_id
          ), child_counts AS (
            SELECT parent_id,COUNT(*) AS child_count FROM category
            WHERE deleted_at IS NULL AND parent_id IS NOT NULL GROUP BY parent_id
          )
          SELECT c.id,c.name,c.parent_id AS parentId,p.name AS parentName,c.level,c.sort_order AS sortOrder,
            c.icon,c.status,COALESCE(children.child_count,0) AS childCount,
            COALESCE(products.product_count,0) AS productCount
          FROM category c
          LEFT JOIN category p ON p.id=c.parent_id AND p.deleted_at IS NULL
          LEFT JOIN child_counts children ON children.parent_id=c.id
          LEFT JOIN product_counts products ON products.ancestor_id=c.id
          WHERE c.deleted_at IS NULL ORDER BY c.level,c.sort_order,c.id
          """).query().listOfRows();
    }

    @PostMapping("/categories") @ResponseStatus(HttpStatus.CREATED)
    void createCategory(@Valid @RequestBody CategoryRequest r) {
        validateCategoryParent(null,r.parentId(),r.level());
        jdbc.sql("""
          INSERT INTO category(name,parent_id,level,sort_order,icon,status)
          VALUES(:name,:parentId,:level,:sortOrder,:icon,:status)
          """).param("name",r.name()).param("parentId",r.parentId()).param("level",r.level())
          .param("sortOrder",r.sortOrder()).param("icon",value(r.icon())).param("status",r.status()).update();
    }

    @PutMapping("/categories/{id}")
    void updateCategory(@PathVariable long id,@Valid @RequestBody CategoryRequest r) {
        validateCategoryParent(id,r.parentId(),r.level());
        require(jdbc.sql("""
          UPDATE category SET name=:name,parent_id=:parentId,level=:level,sort_order=:sortOrder,
            icon=:icon,status=:status WHERE id=:id AND deleted_at IS NULL
          """).param("id",id).param("name",r.name()).param("parentId",r.parentId()).param("level",r.level())
          .param("sortOrder",r.sortOrder()).param("icon",value(r.icon())).param("status",r.status()).update(),
          "分类不存在");
    }

    @DeleteMapping("/categories/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteCategory(@PathVariable long id) {
        long children=jdbc.sql("SELECT COUNT(*) FROM category WHERE parent_id=:id AND deleted_at IS NULL")
          .param("id",id).query(Long.class).single();
        long products=jdbc.sql("SELECT COUNT(*) FROM product_spu WHERE category_id=:id AND deleted_at IS NULL")
          .param("id",id).query(Long.class).single();
        if(children>0) throw new IllegalArgumentException("分类下存在子分类，不能删除");
        if(products>0) throw new IllegalArgumentException("分类已关联商品，不能删除");
        require(jdbc.sql("UPDATE category SET deleted_at=NOW(),status=0 WHERE id=:id AND deleted_at IS NULL")
          .param("id",id).update(),"分类不存在");
    }

    @GetMapping("/enterprises")
    Object enterprises(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                       @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
          SELECT e.id,e.name,e.credit_code AS creditCode,e.contact_name AS contactName,e.contact_phone AS contactPhone,
            e.address,e.status,COUNT(DISTINCT u.id) AS memberCount,MAX(a.name) AS agreementName,
            DATE_FORMAT(e.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM enterprise e LEFT JOIN enterprise_user u ON u.enterprise_id=e.id AND u.deleted_at IS NULL
          LEFT JOIN agreement a ON a.enterprise_id=e.id AND a.status=1 AND a.deleted_at IS NULL
          WHERE e.deleted_at IS NULL GROUP BY e.id
          """;
        if(page==null) return jdbc.sql(base+" ORDER BY id DESC").query().listOfRows();
        return PageSupport.query(jdbc,base,"q.id DESC",Map.of(),page,pageSize,keyword,status,
          List.of("name","creditCode","contactName","contactPhone","address"),"status");
    }

    @PostMapping("/enterprises") @ResponseStatus(HttpStatus.CREATED)
    void createEnterprise(@Valid @RequestBody EnterpriseRequest r) {
        jdbc.sql("""
          INSERT INTO enterprise(name,credit_code,contact_name,contact_phone,address,audit_status,status)
          VALUES(:name,:creditCode,:contactName,:contactPhone,:address,2,:status)
          """)
          .params(Map.of("name",r.name(),"creditCode",r.creditCode(),"contactName",r.contactName(),
            "contactPhone",r.contactPhone(),"address",value(r.address()),"status",r.status())).update();
    }

    @PutMapping("/enterprises/{id}")
    void updateEnterprise(@PathVariable long id,@Valid @RequestBody EnterpriseRequest r) {
        require(jdbc.sql("""
          UPDATE enterprise SET name=:name,credit_code=:creditCode,contact_name=:contactName,
          contact_phone=:contactPhone,address=:address,status=:status WHERE id=:id AND deleted_at IS NULL
          """)
          .params(Map.of("id",id,"name",r.name(),"creditCode",r.creditCode(),"contactName",r.contactName(),
            "contactPhone",r.contactPhone(),"address",value(r.address()),"status",r.status())).update(),"企业不存在");
    }

    @DeleteMapping("/enterprises/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteEnterprise(@PathVariable long id) {
        long orders=jdbc.sql("SELECT COUNT(*) FROM order_main WHERE enterprise_id=:id").param("id",id).query(Long.class).single();
        if(orders>0) throw new IllegalArgumentException("企业已有订单，只能停用，不能删除");
        require(jdbc.sql("UPDATE enterprise SET deleted_at=NOW(),status=0 WHERE id=:id AND deleted_at IS NULL")
          .param("id",id).update(),"企业不存在");
    }

    @GetMapping("/enterprises/{enterpriseId}/members")
    Object enterpriseMembers(@PathVariable long enterpriseId,@RequestParam(required=false) Integer page,
                             @RequestParam(defaultValue="10") int pageSize,@RequestParam(defaultValue="") String keyword,
                             @RequestParam(required=false) Integer status) {
        String base="""
          SELECT u.id,u.username,u.real_name AS realName,u.phone,u.role_code AS roleCode,u.status,
            u.department_id AS departmentId,d.name AS departmentName,
            GROUP_CONCAT(DISTINCT r.name ORDER BY r.id) AS roleNames,
            DATE_FORMAT(u.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM enterprise_user u
          LEFT JOIN enterprise_department d ON d.id=u.department_id AND d.deleted_at IS NULL
          LEFT JOIN enterprise_user_role ur ON ur.user_id=u.id
          LEFT JOIN enterprise_role r ON r.id=ur.role_id AND r.deleted_at IS NULL
          WHERE u.enterprise_id=:enterpriseId AND u.deleted_at IS NULL
          GROUP BY u.id,d.name
          """;
        var params=Map.of("enterpriseId",enterpriseId);
        if(page==null) return jdbc.sql(base+" ORDER BY id").params(params).query().listOfRows();
        return PageSupport.query(jdbc,base,"q.id",params,page,pageSize,keyword,status,
          List.of("username","realName","phone","roleCode"),"status");
    }

    @GetMapping("/enterprise-users")
    Object enterpriseUsers(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                           @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
          SELECT u.id,u.enterprise_id AS enterpriseId,e.name AS enterpriseName,u.username,
            u.real_name AS realName,u.phone,u.role_code AS roleCode,u.status,d.name AS departmentName,
            GROUP_CONCAT(DISTINCT r.name ORDER BY r.id) AS roleNames,
            DATE_FORMAT(u.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM enterprise_user u JOIN enterprise e ON e.id=u.enterprise_id
          LEFT JOIN enterprise_department d ON d.id=u.department_id AND d.deleted_at IS NULL
          LEFT JOIN enterprise_user_role ur ON ur.user_id=u.id
          LEFT JOIN enterprise_role r ON r.id=ur.role_id AND r.deleted_at IS NULL
          WHERE u.deleted_at IS NULL AND e.deleted_at IS NULL
          GROUP BY u.id,e.name,d.name
          """;
        if(page==null) return jdbc.sql(base+" ORDER BY CASE WHEN u.status=2 THEN 0 ELSE 1 END,u.created_at DESC,u.id DESC").query().listOfRows();
        return PageSupport.query(jdbc,base,"CASE WHEN q.status=2 THEN 0 ELSE 1 END,q.createdAt DESC,q.id DESC",Map.of(),page,pageSize,keyword,status,
          List.of("enterpriseName","username","realName","phone","roleCode"),"status");
    }

    @PostMapping("/enterprises/{enterpriseId}/members") @ResponseStatus(HttpStatus.CREATED) @Transactional
    void createEnterpriseMember(@PathVariable long enterpriseId,@Valid @RequestBody EnterpriseMemberRequest r) {
        validatePassword(r.password(),true);
        require(jdbc.sql("SELECT COUNT(*) FROM enterprise WHERE id=:id AND deleted_at IS NULL")
          .param("id",enterpriseId).query(Integer.class).single(),"企业不存在");
        jdbc.sql("""
          INSERT INTO enterprise_user(enterprise_id,username,password_hash,real_name,phone,role_code,status)
          VALUES(:enterpriseId,:username,:password,:realName,:phone,:roleCode,:status)
          """).params(Map.of("enterpriseId",enterpriseId,"username",r.username(),"realName",r.realName(),
          "password",encoder.encode(r.password()),"phone",r.phone(),"roleCode",r.roleCode(),"status",r.status())).update();
        long memberId=jdbc.sql("SELECT id FROM enterprise_user WHERE enterprise_id=:enterpriseId AND username=:username")
          .params(Map.of("enterpriseId",enterpriseId,"username",r.username())).query(Long.class).single();
        syncEnterpriseRole(enterpriseId,memberId,r.roleCode());
    }

    @PutMapping("/enterprises/{enterpriseId}/members/{memberId}") @Transactional
    void updateEnterpriseMember(@PathVariable long enterpriseId,@PathVariable long memberId,
                                @Valid @RequestBody EnterpriseMemberRequest r) {
        validatePassword(r.password(),false);
        require(jdbc.sql("""
          UPDATE enterprise_user SET username=:username,real_name=:realName,phone=:phone,
            role_code=:roleCode,status=:status
          WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
          """).params(Map.of("enterpriseId",enterpriseId,"memberId",memberId,"username",r.username(),
          "realName",r.realName(),"phone",r.phone(),"roleCode",r.roleCode(),"status",r.status())).update(),
          "企业成员不存在");
        if(r.password()!=null&&!r.password().isBlank()) {
            jdbc.sql("""
              UPDATE enterprise_user SET password_hash=:password
              WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
              """).params(Map.of("enterpriseId",enterpriseId,"memberId",memberId,
              "password",encoder.encode(r.password()))).update();
        }
        syncEnterpriseRole(enterpriseId,memberId,r.roleCode());
    }

    @DeleteMapping("/enterprises/{enterpriseId}/members/{memberId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteEnterpriseMember(@PathVariable long enterpriseId,@PathVariable long memberId) {
        var found=jdbc.sql("""
          SELECT role_code AS roleCode FROM enterprise_user
          WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
          """).params(Map.of("enterpriseId",enterpriseId,"memberId",memberId)).query().listOfRows();
        if(found.isEmpty()) throw new IllegalArgumentException("企业成员不存在");
        var member=found.getFirst();
        if("ENTERPRISE_ADMIN".equals(member.get("roleCode"))) {
            long admins=jdbc.sql("""
              SELECT COUNT(*) FROM enterprise_user
              WHERE enterprise_id=:enterpriseId AND role_code='ENTERPRISE_ADMIN' AND deleted_at IS NULL
              """).param("enterpriseId",enterpriseId).query(Long.class).single();
            if(admins<=1) throw new IllegalArgumentException("企业至少需要保留一名管理员");
        }
        require(jdbc.sql("""
          UPDATE enterprise_user SET deleted_at=NOW(),status=0
          WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
          """).params(Map.of("enterpriseId",enterpriseId,"memberId",memberId)).update(),"企业成员不存在");
    }

    @GetMapping("/agreements")
    Object agreements(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                      @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
          SELECT a.id,a.agreement_no AS agreementNo,a.name,a.enterprise_id AS enterpriseId,e.name AS enterpriseName,
            a.amount,DATE_FORMAT(a.effective_date,'%Y-%m-%d') AS effectiveDate,
            DATE_FORMAT(a.expiry_date,'%Y-%m-%d') AS expiryDate,a.status,COUNT(ai.id) AS itemCount
          FROM agreement a JOIN enterprise e ON e.id=a.enterprise_id
          LEFT JOIN agreement_item ai ON ai.agreement_id=a.id AND ai.deleted_at IS NULL
          WHERE a.deleted_at IS NULL GROUP BY a.id
          """;
        if(page==null) return jdbc.sql(base+" ORDER BY id DESC").query().listOfRows();
        return PageSupport.query(jdbc,base,"q.id DESC",Map.of(),page,pageSize,keyword,status,
          List.of("agreementNo","name","enterpriseName"),"status");
    }

    @PostMapping("/agreements") @ResponseStatus(HttpStatus.CREATED) @Transactional
    void createAgreement(@Valid @RequestBody AgreementRequest r) {
        if(r.status()==1) jdbc.sql("UPDATE agreement SET status=2 WHERE enterprise_id=:id AND status=1 AND deleted_at IS NULL")
          .param("id",r.enterpriseId()).update();
        String no="AGR-"+LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
          +"-"+UUID.randomUUID().toString().substring(0,8);
        jdbc.sql("""
          INSERT INTO agreement(agreement_no,enterprise_id,name,amount,effective_date,expiry_date,status)
          VALUES(:no,:enterpriseId,:name,:amount,:effectiveDate,:expiryDate,:status)
          """)
          .params(Map.of("no",no,"enterpriseId",r.enterpriseId(),"name",r.name(),"amount",r.amount(),
            "effectiveDate",r.effectiveDate(),"expiryDate",r.expiryDate(),"status",r.status())).update();
    }

    @PutMapping("/agreements/{id}") @Transactional
    void updateAgreement(@PathVariable long id,@Valid @RequestBody AgreementRequest r) {
        if(r.status()==1) jdbc.sql("UPDATE agreement SET status=2 WHERE enterprise_id=:enterpriseId AND status=1 AND id<>:id AND deleted_at IS NULL")
          .params(Map.of("enterpriseId",r.enterpriseId(),"id",id)).update();
        require(jdbc.sql("""
          UPDATE agreement SET enterprise_id=:enterpriseId,name=:name,amount=:amount,
          effective_date=:effectiveDate,expiry_date=:expiryDate,status=:status WHERE id=:id AND deleted_at IS NULL
          """)
          .params(Map.of("id",id,"enterpriseId",r.enterpriseId(),"name",r.name(),"amount",r.amount(),
            "effectiveDate",r.effectiveDate(),"expiryDate",r.expiryDate(),"status",r.status())).update(),"协议不存在");
    }

    @DeleteMapping("/agreements/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteAgreement(@PathVariable long id) {
        long orders=jdbc.sql("SELECT COUNT(*) FROM order_main WHERE agreement_id=:id").param("id",id).query(Long.class).single();
        if(orders>0) throw new IllegalArgumentException("协议已有订单引用，只能停用，不能删除");
        require(jdbc.sql("UPDATE agreement SET deleted_at=NOW(),status=2 WHERE id=:id AND deleted_at IS NULL")
          .param("id",id).update(),"协议不存在");
    }

    @GetMapping("/orders")
    Object orders(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                  @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
          SELECT o.id,o.order_no AS orderNo,e.name AS enterpriseName,u.real_name AS buyerName,
            u.username AS buyerUsername,u.phone AS buyerPhone,a.name AS agreementName,
            o.item_amount AS itemAmount,o.freight_amount AS freightAmount,o.payable_amount AS payableAmount,
            o.payment_status AS paymentStatus,o.order_status AS orderStatus,o.refund_status AS refundStatus,
            o.refund_amount AS refundAmount,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'id',item.id,'title',spu.title,'mainImage',spu.main_image,'skuCode',sku.sku_code,
              'quantity',item.quantity,'unitPrice',item.unit_price,'totalPrice',item.total_price,
              'fulfillmentStatus',item.fulfillment_status,'logisticsCompany',item.logistics_company,'logisticsNo',item.logistics_no))
              FROM order_item item JOIN product_sku sku ON sku.id=item.sku_id
              JOIN product_spu spu ON spu.id=sku.spu_id WHERE item.order_main_id=o.id),JSON_ARRAY()) AS items,
            DATE_FORMAT(o.payment_due_at,'%Y-%m-%d %H:%i:%s') AS paymentDueAt,
            DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
            DATE_FORMAT(o.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt,COUNT(oi.id) AS itemKinds,SUM(oi.quantity) AS itemCount
          FROM order_main o JOIN enterprise e ON e.id=o.enterprise_id JOIN enterprise_user u ON u.id=o.user_id
          LEFT JOIN agreement a ON a.id=o.agreement_id LEFT JOIN order_item oi ON oi.order_main_id=o.id
          GROUP BY o.id,u.id,a.id
          """;
        if(page==null) return jdbc.sql(base+" ORDER BY id DESC").query().listOfRows();
        return PageSupport.query(jdbc,base,"q.id DESC",Map.of(),page,pageSize,keyword,status,
          List.of("orderNo","enterpriseName","buyerName","buyerUsername","buyerPhone","agreementName"),"orderStatus");
    }

    @GetMapping("/agreement-orders")
    Object agreementOrders(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                           @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
          SELECT o.id,o.order_no AS orderNo,e.name AS enterpriseName,u.real_name AS buyerName,
            u.username AS buyerUsername,u.phone AS buyerPhone,a.name AS agreementName,
            o.item_amount AS itemAmount,o.freight_amount AS freightAmount,o.payable_amount AS payableAmount,o.payment_status AS paymentStatus,
            o.order_status AS orderStatus,o.refund_status AS refundStatus,o.refund_amount AS refundAmount,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'id',item.id,'title',spu.title,'mainImage',spu.main_image,'skuCode',sku.sku_code,
              'quantity',item.quantity,'unitPrice',item.unit_price,'totalPrice',item.total_price,
              'fulfillmentStatus',item.fulfillment_status,'logisticsCompany',item.logistics_company,'logisticsNo',item.logistics_no))
              FROM order_item item JOIN product_sku sku ON sku.id=item.sku_id
              JOIN product_spu spu ON spu.id=sku.spu_id WHERE item.order_main_id=o.id),JSON_ARRAY()) AS items,
            DATE_FORMAT(o.payment_due_at,'%Y-%m-%d %H:%i:%s') AS paymentDueAt,
            DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
            DATE_FORMAT(o.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt,
            COUNT(oi.id) AS itemKinds,SUM(oi.quantity) AS itemCount
          FROM order_main o JOIN enterprise e ON e.id=o.enterprise_id JOIN enterprise_user u ON u.id=o.user_id JOIN agreement a ON a.id=o.agreement_id
          LEFT JOIN order_item oi ON oi.order_main_id=o.id
          GROUP BY o.id,u.id,a.id
          """;
        if(page==null) return jdbc.sql(base+" ORDER BY id DESC").query().listOfRows();
        return PageSupport.query(jdbc,base,"q.id DESC",Map.of(),page,pageSize,keyword,status,
          List.of("orderNo","enterpriseName","buyerName","buyerUsername","buyerPhone","agreementName"),"orderStatus");
    }

    @GetMapping("/platform-orders")
    Object platformOrders(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                          @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
          SELECT o.id,o.order_no AS orderNo,e.name AS enterpriseName,u.real_name AS buyerName,
            u.username AS buyerUsername,u.phone AS buyerPhone,a.name AS agreementName,
            o.item_amount AS itemAmount,o.freight_amount AS freightAmount,o.payable_amount AS payableAmount,
            o.payment_status AS paymentStatus,o.order_status AS orderStatus,o.refund_status AS refundStatus,
            o.refund_amount AS refundAmount,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'id',item.id,'title',spu.title,'mainImage',spu.main_image,'skuCode',sku.sku_code,
              'quantity',item.quantity,'unitPrice',item.unit_price,'totalPrice',item.total_price,
              'fulfillmentStatus',item.fulfillment_status,'logisticsCompany',item.logistics_company,'logisticsNo',item.logistics_no))
              FROM order_item item JOIN product_sku sku ON sku.id=item.sku_id
              JOIN product_spu spu ON spu.id=sku.spu_id WHERE item.order_main_id=o.id),JSON_ARRAY()) AS items,
            DATE_FORMAT(o.payment_due_at,'%Y-%m-%d %H:%i:%s') AS paymentDueAt,
            DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
            DATE_FORMAT(o.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt,
            COUNT(oi.id) AS itemKinds,SUM(oi.quantity) AS itemCount,platforms.platformNames
          FROM order_main o JOIN enterprise e ON e.id=o.enterprise_id JOIN enterprise_user u ON u.id=o.user_id
          LEFT JOIN agreement a ON a.id=o.agreement_id
          LEFT JOIN order_item oi ON oi.order_main_id=o.id
          JOIN (
            SELECT oi2.order_main_id,
              GROUP_CONCAT(DISTINCT pr.title ORDER BY pr.sort_order SEPARATOR '、') AS platformNames
            FROM order_item oi2 JOIN product_platform pp ON pp.sku_id=oi2.sku_id AND pp.deleted_at IS NULL
            JOIN portal_resource pr ON pr.id=pp.platform_id AND pr.resource_type='PLATFORM' AND pr.deleted_at IS NULL
            GROUP BY oi2.order_main_id
          ) platforms ON platforms.order_main_id=o.id
          GROUP BY o.id,u.id,a.id,platforms.platformNames
          """;
        if(page==null) return jdbc.sql(base+" ORDER BY id DESC").query().listOfRows();
        return PageSupport.query(jdbc,base,"q.id DESC",Map.of(),page,pageSize,keyword,status,
          List.of("orderNo","enterpriseName","buyerName","buyerUsername","buyerPhone","agreementName","platformNames"),"orderStatus");
    }

    @GetMapping("/orders/{id}")
    Map<String,Object> order(@PathVariable long id) {
        var order=jdbc.sql("""
          SELECT o.id,o.order_no AS orderNo,e.name AS enterpriseName,u.real_name AS buyerName,
            u.username AS buyerUsername,u.phone AS buyerPhone,a.name AS agreementName,
            o.item_amount AS itemAmount,o.freight_amount AS freightAmount,o.payable_amount AS payableAmount,
            o.payment_status AS paymentStatus,o.order_status AS orderStatus,o.refund_status AS refundStatus,
            o.refund_amount AS refundAmount,o.refund_reason AS refundReason,
            o.payment_bank_snapshot AS paymentBankSnapshot,
            DATE_FORMAT(o.refunded_at,'%Y-%m-%d %H:%i:%s') AS refundedAt,
            DATE_FORMAT(o.payment_due_at,'%Y-%m-%d %H:%i:%s') AS paymentDueAt,
            DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
            DATE_FORMAT(o.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt
          FROM order_main o JOIN enterprise e ON e.id=o.enterprise_id JOIN enterprise_user u ON u.id=o.user_id
          LEFT JOIN agreement a ON a.id=o.agreement_id WHERE o.id=:id
          """)
          .param("id",id).query().singleRow();
        var items=jdbc.sql("""
          SELECT oi.id,p.title,p.main_image AS mainImage,s.sku_code AS skuCode,
            os.sub_order_no AS subOrderNo,os.address_snapshot AS addressSnapshot,
            oi.quantity,oi.unit_price AS unitPrice,oi.total_price AS totalPrice,
            oi.fulfillment_status AS fulfillmentStatus,oi.logistics_company AS logisticsCompany,
            oi.logistics_no AS logisticsNo,oi.logistics_status AS logisticsStatus,
            DATE_FORMAT(oi.shipped_at,'%Y-%m-%d %H:%i:%s') AS shippedAt
          FROM order_item oi JOIN product_sku s ON s.id=oi.sku_id
          JOIN product_spu p ON p.id=s.spu_id JOIN order_sub os ON os.id=oi.order_sub_id
          WHERE oi.order_main_id=:id ORDER BY os.id,oi.id
          """).param("id",id).query().listOfRows();
        var timeline=jdbc.sql("""
          SELECT event_type AS eventType,from_status AS fromStatus,to_status AS toStatus,
            description,operator_type AS operatorType,
            DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM order_event WHERE order_main_id=:id ORDER BY id DESC
          """).param("id",id).query().listOfRows();
        return Map.of("order",order,"items",items,"timeline",timeline);
    }

    @PutMapping("/orders/{orderId}/items/{itemId}/logistics")
    @Transactional
    void itemLogistics(@PathVariable long orderId,@PathVariable long itemId,
                       @RequestBody ItemLogisticsRequest r) {
        List<Map<String,Object>> orders=jdbc.sql("""
          SELECT order_status AS orderStatus,refund_status AS refundStatus
          FROM order_main WHERE id=:id FOR UPDATE
          """).param("id",orderId).query().listOfRows();
        if(orders.isEmpty()) throw new IllegalArgumentException("订单不存在");
        int currentOrderStatus=((Number)orders.getFirst().get("orderStatus")).intValue();
        int refundStatus=((Number)orders.getFirst().get("refundStatus")).intValue();
        if(currentOrderStatus==3||currentOrderStatus==4||refundStatus!=0)
            throw new IllegalArgumentException("已完成、已取消或已退款订单不能修改物流信息");
        if(r.fulfillmentStatus()>0&&(value(r.logisticsCompany()).isBlank()||value(r.logisticsNo()).isBlank()))
            throw new IllegalArgumentException("已发货商品必须填写物流公司和运单号");
        var itemStatuses=jdbc.sql("""
          SELECT fulfillment_status FROM order_item WHERE id=:itemId AND order_main_id=:orderId
          """).params(Map.of("itemId",itemId,"orderId",orderId)).query(Integer.class).list();
        if(itemStatuses.isEmpty()) throw new IllegalArgumentException("订单商品不存在");
        int currentItemStatus=itemStatuses.getFirst();
        if(!OrderStatePolicy.canTransitionItem(currentItemStatus,r.fulfillmentStatus()))
            throw new IllegalArgumentException("商品物流状态不允许从"+fulfillmentName(currentItemStatus)
              +"变更为"+fulfillmentName(r.fulfillmentStatus()));
        if(currentItemStatus==0&&r.fulfillmentStatus()>0&&r.fulfillmentStatus()<4)
            inventory.commitShipment(orderId,itemId);
        if(currentItemStatus==0&&r.fulfillmentStatus()==4)
            inventory.releaseItem(orderId,itemId);
        require(jdbc.sql("""
          UPDATE order_item SET fulfillment_status=:status,logistics_company=:company,
            logistics_no=:logisticsNo,logistics_status=:logisticsStatus,
            shipped_at=CASE WHEN :status>0 THEN COALESCE(shipped_at,NOW()) ELSE NULL END
          WHERE id=:itemId AND order_main_id=:orderId
          """).params(Map.of("status",r.fulfillmentStatus(),"company",value(r.logisticsCompany()),
            "logisticsNo",value(r.logisticsNo()),"logisticsStatus",value(r.logisticsStatus()),
            "itemId",itemId,"orderId",orderId)).update(),"订单商品不存在");
        Map<String,Object> stats=jdbc.sql("""
          SELECT COUNT(*) total,
            SUM(CASE WHEN fulfillment_status=0 THEN 1 ELSE 0 END) pending,
            SUM(CASE WHEN fulfillment_status IN (1,2) THEN 1 ELSE 0 END) shipped,
            SUM(CASE WHEN fulfillment_status=3 THEN 1 ELSE 0 END) delivered,
            SUM(CASE WHEN fulfillment_status=4 THEN 1 ELSE 0 END) cancelled
          FROM order_item WHERE order_main_id=:orderId
          """).param("orderId",orderId).query().singleRow();
        int total=((Number)stats.get("total")).intValue();
        int pending=((Number)stats.get("pending")).intValue();
        int shipped=((Number)stats.get("shipped")).intValue();
        int delivered=((Number)stats.get("delivered")).intValue();
        int cancelled=((Number)stats.get("cancelled")).intValue();
        int orderStatus=OrderStatePolicy.deriveOrderStatus(total,pending,shipped,delivered,cancelled);
        jdbc.sql("UPDATE order_main SET order_status=:status WHERE id=:id AND order_status<>4")
          .params(Map.of("status",orderStatus,"id",orderId)).update();
        addOrderEvent(orderId,"ITEM_LOGISTICS",currentOrderStatus,orderStatus,
          "商品物流状态更新为"+fulfillmentName(r.fulfillmentStatus()));
    }

    @PutMapping("/orders/{id}/status")
    @Transactional
    void orderStatus(@PathVariable long id,@RequestBody OrderStatusRequest r) {
        List<Map<String,Object>> orders=jdbc.sql("""
          SELECT order_status AS orderStatus,payment_status AS paymentStatus,refund_status AS refundStatus
          FROM order_main WHERE id=:id FOR UPDATE
          """).param("id",id).query().listOfRows();
        if(orders.isEmpty()) throw new IllegalArgumentException("订单不存在");
        int current=((Number)orders.getFirst().get("orderStatus")).intValue();
        int currentPayment=((Number)orders.getFirst().get("paymentStatus")).intValue();
        int refund=((Number)orders.getFirst().get("refundStatus")).intValue();
        if(refund!=0) throw new IllegalArgumentException("退款订单不能推进状态");
        boolean confirmPayment=current==0&&r.orderStatus()==1&&r.paymentStatus()==2;
        boolean complete=(current==2||current==5)&&r.orderStatus()==3
          && currentPayment==2&&r.paymentStatus()==2;
        if(!confirmPayment&&!complete)
            throw new IllegalArgumentException("当前订单状态不允许执行该操作");
        if(complete) {
            long pending=jdbc.sql("""
              SELECT COUNT(*) FROM order_item
              WHERE order_main_id=:id AND fulfillment_status=0
              """).param("id",id).query(Long.class).single();
            if(pending>0) throw new IllegalArgumentException("订单仍有待发货商品，不能完成订单");
            jdbc.sql("""
              UPDATE order_item SET fulfillment_status=3,
                logistics_status='已签收'
              WHERE order_main_id=:id AND fulfillment_status IN (1,2)
              """).param("id",id).update();
        }
        require(jdbc.sql("UPDATE order_main SET payment_status=:paymentStatus,order_status=:orderStatus WHERE id=:id AND order_status=:current")
          .params(Map.of("id",id,"current",current,"paymentStatus",r.paymentStatus(),"orderStatus",r.orderStatus())).update(),"订单状态已变化，请刷新后重试");
        addOrderEvent(id,confirmPayment?"PAYMENT_CONFIRMED":"ORDER_COMPLETED",current,r.orderStatus(),
          confirmPayment?"确认银行转账到账":"确认订单完成，商品同步签收");
    }

    @PostMapping("/orders/{id}/refund")
    @Transactional
    void refundOrder(@PathVariable long id,@Valid @RequestBody RefundRequest r) {
        List<Map<String,Object>> orders=jdbc.sql("""
          SELECT order_status AS orderStatus,payment_status AS paymentStatus,
            refund_status AS refundStatus,payable_amount AS payableAmount
          FROM order_main WHERE id=:id FOR UPDATE
          """).param("id",id).query().listOfRows();
        if(orders.isEmpty()) throw new IllegalArgumentException("订单不存在");
        Map<String,Object> order=orders.get(0);
        if(((Number)order.get("orderStatus")).intValue()!=3)
            throw new IllegalArgumentException("只有已完成订单可以退款");
        if(((Number)order.get("paymentStatus")).intValue()!=2)
            throw new IllegalArgumentException("只有已确认到账订单可以退款");
        if(((Number)order.get("refundStatus")).intValue()!=0)
            throw new IllegalArgumentException("订单已经退款，不能重复操作");
        BigDecimal payable=(BigDecimal)order.get("payableAmount");
        if(r.refundAmount().compareTo(BigDecimal.ZERO)<=0||r.refundAmount().compareTo(payable)>0)
            throw new IllegalArgumentException("退款金额必须大于0且不能超过订单实付金额");
        require(jdbc.sql("""
          UPDATE order_main SET refund_status=1,refund_amount=:amount,refund_reason=:reason,refunded_at=NOW()
          WHERE id=:id AND order_status=3 AND payment_status=2 AND refund_status=0
          """).params(Map.of("id",id,"amount",r.refundAmount(),"reason",r.refundReason())).update(),
          "订单退款状态已变化，请刷新后重试");
        addOrderEvent(id,"ORDER_REFUNDED",3,3,
          "退款¥"+r.refundAmount().toPlainString()+"，原因："+r.refundReason());
    }

    private void addOrderEvent(long orderId,String type,Integer fromStatus,Integer toStatus,String description) {
        jdbc.sql("""
          INSERT INTO order_event(order_main_id,event_type,from_status,to_status,description,operator_type)
          VALUES(:orderId,:type,:fromStatus,:toStatus,:description,'ADMIN')
          """).params(Map.of("orderId",orderId,"type",type,"fromStatus",fromStatus,
            "toStatus",toStatus,"description",description)).update();
    }
    private static String fulfillmentName(int status) {
        return switch(status) {case 0->"待发货";case 1->"已发货";case 2->"运输中";case 3->"已签收";case 4->"已取消";default->"未知";};
    }

    private static String value(String s){return s==null?"":s;}
    private String uniqueProductCode() {
        for(int attempt=0;attempt<20;attempt++) {
            String code=System.currentTimeMillis()+String.format("%06d",CODE_RANDOM.nextInt(1_000_000));
            long existing=jdbc.sql("""
              SELECT (SELECT COUNT(*) FROM product_spu WHERE spu_code=:code)
                   + (SELECT COUNT(*) FROM product_sku WHERE sku_code=:code)
              """).param("code",code).query(Long.class).single();
            if(existing==0) return code;
        }
        throw new IllegalStateException("商品编码生成失败，请重试");
    }
    private void saveAttributeValues(long productId,Map<String,Object> values) {
        jdbc.sql("DELETE FROM product_attribute_value WHERE product_id=:id").param("id",productId).update();
        if(values==null) return;
        values.forEach((attributeId,value)->{
            long id=Long.parseLong(attributeId);
            String inputType=jdbc.sql("SELECT input_type FROM attribute_definition WHERE id=:id AND deleted_at IS NULL")
              .param("id",id).query(String.class).optional().orElseThrow(()->new IllegalArgumentException("商品属性不存在"));
            boolean optionType=List.of("SELECT","RADIO","CHECKBOX").contains(inputType);
            List<?> source=value instanceof List<?> list?list:List.of(value==null?"":value);
            if(optionType) {
                var optionIds=new java.util.ArrayList<Long>();var labels=new java.util.ArrayList<String>();
                for(Object raw:source) if(!String.valueOf(raw).isBlank()) {
                    long optionId;
                    try{optionId=Long.parseLong(String.valueOf(raw));}catch(NumberFormatException e){throw new IllegalArgumentException("请选择有效的属性选项");}
                    String label=jdbc.sql("SELECT option_label FROM attribute_option WHERE id=:optionId AND attribute_id=:attributeId AND status=1 AND deleted_at IS NULL")
                      .params(Map.of("optionId",optionId,"attributeId",id)).query(String.class).optional()
                      .orElseThrow(()->new IllegalArgumentException("属性选项不存在或已停用"));
                    optionIds.add(optionId);labels.add(label);
                }
                if(!optionIds.isEmpty()) jdbc.sql("""
                  INSERT INTO product_attribute_value(product_id,attribute_id,value_text,option_ids)
                  VALUES(:productId,:attributeId,:value,CAST(:optionIds AS JSON))
                  """).params(Map.of("productId",productId,"attributeId",id,"value",String.join("、",labels),"optionIds",toJson(optionIds))).update();
            } else {
                String text=source.stream().map(String::valueOf).reduce((a,b)->a+"、"+b).orElse("");
                if(!text.isBlank()) jdbc.sql("INSERT INTO product_attribute_value(product_id,attribute_id,value_text) VALUES(:productId,:attributeId,:value)")
                  .params(Map.of("productId",productId,"attributeId",id,"value",text)).update();
            }
        });
    }
    private static void require(int n,String message){if(n==0)throw new IllegalArgumentException(message);}
    private void validateBadge(Long productId,ProductRequest r) {
        if(r.badgeType()==null) return;
        String type=normalizedBadgeType(r.badgeType());
        if(!Set.of("NONE","AGREEMENT","PLATFORM","CUSTOM").contains(type))
            throw new IllegalArgumentException("商品角标类型不正确");
        if("PLATFORM".equals(type)) {
            if(r.badgePlatformId()==null) throw new IllegalArgumentException("平台角标必须选择平台");
            if(productId==null) throw new IllegalArgumentException("请先保存商品并关联平台，再配置平台角标");
            int count=jdbc.sql("""
              SELECT COUNT(*) FROM product_platform pp JOIN product_sku s ON s.id=pp.sku_id
              JOIN portal_resource pr ON pr.id=pp.platform_id AND pr.resource_type='PLATFORM' AND pr.status=1 AND pr.deleted_at IS NULL
              WHERE s.spu_id=:productId AND pp.platform_id=:platformId AND pp.deleted_at IS NULL
              """).param("productId",productId).param("platformId",r.badgePlatformId()).query(Integer.class).single();
            if(count==0) throw new IllegalArgumentException("角标平台必须是商品当前已关联的平台");
        }
        if("CUSTOM".equals(type)) {
            String badge=value(r.customBadge()).trim();
            int length=badge.codePointCount(0,badge.length());
            boolean allHan=badge.codePoints().allMatch(codePoint->Character.UnicodeScript.of(codePoint)==Character.UnicodeScript.HAN);
            if(length<2||length>5||!allHan) throw new IllegalArgumentException("自定义角标必须为2至5个汉字");
        }
    }
    private static String normalizedBadgeType(String type){return type==null?null:type.trim().toUpperCase();}
    private static String persistedBadgeType(String type){
        String normalized=normalizedBadgeType(type);return "NONE".equals(normalized)?null:normalized;
    }
    private static Long normalizedBadgePlatformId(ProductRequest r){
        return "PLATFORM".equals(normalizedBadgeType(r.badgeType()))?r.badgePlatformId():null;
    }
    private static String normalizedCustomBadge(ProductRequest r){
        return "CUSTOM".equals(normalizedBadgeType(r.badgeType()))?value(r.customBadge()).trim():null;
    }
    private static String normalizedCollectionPlatform(String platform){
        String normalized=value(platform).trim().toLowerCase();
        if(normalized.isBlank()) return null;
        if(!Set.of("jd","taobao","huiecai","qilu").contains(normalized))
            throw new IllegalArgumentException("商品采集来源平台不正确");
        return normalized;
    }
    private static String normalizedCollectionSourceUrl(String sourceUrl){
        String normalized=value(sourceUrl).trim();
        if(normalized.isBlank()) return null;
        if(normalized.length()>1000||!(normalized.startsWith("http://")||normalized.startsWith("https://")))
            throw new IllegalArgumentException("商品采集来源链接不正确");
        return normalized;
    }
    private void validateCategoryParent(Long id,Long parentId,int level) {
        if(level<1||level>3) throw new IllegalArgumentException("分类级别必须为1至3级");
        if(level==1&&parentId!=null) throw new IllegalArgumentException("一级分类不能设置上级分类");
        if(level>1&&parentId==null) throw new IllegalArgumentException("二级或三级分类必须选择上级分类");
        if(id!=null&&id.equals(parentId)) throw new IllegalArgumentException("分类不能选择自身为上级");
        if(parentId!=null) {
            int parentLevel=jdbc.sql("SELECT level FROM category WHERE id=:id AND deleted_at IS NULL")
              .param("id",parentId).query(Integer.class).optional()
              .orElseThrow(()->new IllegalArgumentException("上级分类不存在"));
            if(parentLevel!=level-1) throw new IllegalArgumentException("上级分类级别不正确");
        }
    }
    private void saveSkus(long productId,ProductRequest r,String createCode) {
        List<SkuRequest> requested=r.skus();
        if(requested==null||requested.isEmpty()) {
            Long existingId=jdbc.sql("SELECT MIN(id) FROM product_sku WHERE spu_id=:id AND deleted_at IS NULL")
              .param("id",productId).query(Long.class).optional().orElse(null);
            String existingCode=existingId==null?createCode:jdbc.sql("SELECT sku_code FROM product_sku WHERE id=:id")
              .param("id",existingId).query(String.class).single();
            requested=List.of(new SkuRequest(existingId,existingCode,Map.of("规格",value(r.spec())),value(r.mainImage()),"",value(r.mainImage()),
              r.marketPrice(),r.memberPrice(),r.stock()==null?0:r.stock(),r.status()==1?1:0));
        }
        var retained=new java.util.HashSet<Long>();
        for(SkuRequest sku:requested) {
            if(sku.marketPrice()==null||sku.memberPrice()==null||sku.stock()<0)
                throw new IllegalArgumentException("SKU价格和库存不能为空或小于0");
            String code=value(sku.skuCode()).isBlank()?uniqueProductCode():sku.skuCode().trim();
            String specs=toJson(sku.specValues()==null?Map.of():sku.specValues());
            String specification=sku.specValues()==null?"":sku.specValues().values().stream().map(String::valueOf).filter(v->!v.isBlank()).reduce((a,b)->a+" "+b).orElse("");
            String skuTitle=value(sku.skuTitle()).isBlank()?(r.title()+(!specification.isBlank()?" "+specification:"")):sku.skuTitle().trim();
            String gallery=value(sku.skuGallery()).trim();
            String image=value(sku.skuImage()).trim();
            if(image.isBlank()&&retained.isEmpty())image=value(r.mainImage()).trim();
            if(sku.id()==null) {
                jdbc.sql("""
                  INSERT INTO product_sku(spu_id,sku_code,title,spec_json,sku_image,gallery_json,market_price,member_price,stock,status)
                  VALUES(:spuId,:code,:title,CAST(:specs AS JSON),:image,JSON_OBJECT('content',:gallery),:marketPrice,:memberPrice,:stock,:status)
                  """).param("spuId",productId).param("code",code).param("title",skuTitle).param("specs",specs).param("image",image).param("gallery",gallery)
                    .param("marketPrice",sku.marketPrice()).param("memberPrice",sku.memberPrice()).param("stock",sku.stock()).param("status",sku.status()).update();
                retained.add(jdbc.sql("SELECT id FROM product_sku WHERE sku_code=:code").param("code",code).query(Long.class).single());
            } else {
                int reserved=jdbc.sql("SELECT reserved_stock FROM product_sku WHERE id=:id AND spu_id=:spuId")
                  .params(Map.of("id",sku.id(),"spuId",productId)).query(Integer.class).optional()
                  .orElseThrow(()->new IllegalArgumentException("SKU不存在"));
                if(sku.stock()<reserved) throw new IllegalArgumentException("SKU库存不能小于已占用库存 "+reserved);
                jdbc.sql("""
                  UPDATE product_sku SET sku_code=:code,title=:title,spec_json=CAST(:specs AS JSON),sku_image=:image,gallery_json=JSON_OBJECT('content',:gallery),
                    market_price=:marketPrice,member_price=:memberPrice,stock=:stock,status=:status
                  WHERE id=:id AND spu_id=:spuId AND deleted_at IS NULL
                  """).param("id",sku.id()).param("spuId",productId).param("code",code).param("title",skuTitle).param("specs",specs).param("image",image).param("gallery",gallery)
                    .param("marketPrice",sku.marketPrice()).param("memberPrice",sku.memberPrice()).param("stock",sku.stock()).param("status",sku.status()).update();
                retained.add(sku.id());
            }
        }
        for(long id:jdbc.sql("SELECT id FROM product_sku WHERE spu_id=:id AND deleted_at IS NULL")
          .param("id",productId).query(Long.class).list()) if(!retained.contains(id))
            jdbc.sql("UPDATE product_sku SET status=0 WHERE id=:id").param("id",id).update();
    }
    private static String toJson(Object value) {
        try{return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value);}
        catch(Exception e){throw new IllegalArgumentException("SKU规格格式错误");}
    }
    private void saveServiceOptions(long productId,List<Long> optionIds) {
        jdbc.sql("DELETE FROM product_service_option WHERE product_id=:id").param("id",productId).update();
        if(optionIds==null)return;
        for(Long optionId:optionIds) {
            if(optionId==null)continue;
            int exists=jdbc.sql("SELECT COUNT(*) FROM system_option WHERE id=:id AND option_type='PRODUCT_SERVICE' AND status=1 AND deleted_at IS NULL")
              .param("id",optionId).query(Integer.class).single();
            if(exists==0)throw new IllegalArgumentException("商品服务选项不存在或已停用");
            jdbc.sql("INSERT INTO product_service_option(product_id,option_id) VALUES(:productId,:optionId)")
              .param("productId",productId).param("optionId",optionId).update();
        }
    }
    private static void validatePassword(String password,boolean required) {
        if(required&&(password==null||password.isBlank()))
            throw new IllegalArgumentException("初始密码不能为空");
        if(password!=null&&!password.isBlank()&&(password.length()<8||password.length()>72))
            throw new IllegalArgumentException("密码长度必须为8至72位");
    }
    private void syncEnterpriseRole(long enterpriseId,long memberId,String roleCode) {
        List<Long> roleIds=jdbc.sql("""
          SELECT id FROM enterprise_role
          WHERE enterprise_id=:enterpriseId AND role_code=:roleCode AND status=1 AND deleted_at IS NULL
          """).params(Map.of("enterpriseId",enterpriseId,"roleCode",roleCode)).query(Long.class).list();
        if(roleIds.isEmpty())return;
        jdbc.sql("DELETE ur FROM enterprise_user_role ur JOIN enterprise_role r ON r.id=ur.role_id WHERE ur.user_id=:memberId AND r.built_in=1")
          .param("memberId",memberId).update();
        jdbc.sql("INSERT IGNORE INTO enterprise_user_role(user_id,role_id) VALUES(:memberId,:roleId)")
          .params(Map.of("memberId",memberId,"roleId",roleIds.getFirst())).update();
    }
    @GetMapping("/finance/statements")
    List<Map<String,Object>> financeStatements() {
        return jdbc.sql("""
          SELECT s.id,s.statement_no AS statementNo,e.name AS enterpriseName,
            DATE_FORMAT(s.period_start,'%Y-%m-%d') AS periodStart,DATE_FORMAT(s.period_end,'%Y-%m-%d') AS periodEnd,
            s.order_count AS orderCount,s.payable_amount AS payableAmount,s.paid_amount AS paidAmount,s.status,
            DATE_FORMAT(s.due_date,'%Y-%m-%d') AS dueDate,DATE_FORMAT(s.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM reconciliation_statement s JOIN enterprise e ON e.id=s.enterprise_id ORDER BY s.id DESC
          """).query().listOfRows();
    }
    @PutMapping("/finance/statements/{id}/status")
    void updateFinanceStatement(@PathVariable long id,@Valid @RequestBody FinanceStatementStatusRequest request) {
        if(request.status()!=3&&request.status()!=4)throw new IllegalArgumentException("管理后台仅可将对账单标记为已结清或已作废");
        int changed=jdbc.sql("""
          UPDATE reconciliation_statement SET status=:status,paid_amount=CASE WHEN :status=3 THEN payable_amount ELSE paid_amount END,
            paid_at=CASE WHEN :status=3 THEN NOW() ELSE paid_at END,remark=:remark
          WHERE id=:id AND status IN (1,2)
          """).param("status",request.status()).param("remark",request.remark()).param("id",id).update();
        if(changed==0)throw new IllegalArgumentException("对账单不存在或状态不允许变更");
        if(request.status()==3)jdbc.sql("""
          UPDATE order_main o JOIN reconciliation_statement_order so ON so.order_main_id=o.id
          SET o.payment_status=2,o.order_status=CASE WHEN o.order_status=0 THEN 1 ELSE o.order_status END
          WHERE so.statement_id=:id AND o.order_status<>4
          """).param("id",id).update();
    }
    @GetMapping("/finance/invoice-applications")
    List<Map<String,Object>> financeInvoiceApplications() {
        return jdbc.sql("""
          SELECT a.id,a.application_no AS applicationNo,e.name AS enterpriseName,u.real_name AS applicantName,
            a.invoice_title AS invoiceTitle,a.tax_no AS taxNo,a.invoice_type AS invoiceType,
            a.recipient_email AS recipientEmail,a.amount,a.status,a.invoice_no AS invoiceNo,
            a.invoice_file_url AS invoiceFileUrl,a.failure_reason AS failureReason,COUNT(ao.order_main_id) AS orderCount,
            DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM invoice_application a JOIN enterprise e ON e.id=a.enterprise_id JOIN enterprise_user u ON u.id=a.applicant_user_id
          LEFT JOIN invoice_application_order ao ON ao.application_id=a.id GROUP BY a.id ORDER BY a.id DESC
          """).query().listOfRows();
    }
    @PutMapping("/finance/invoice-applications/{id}")
    void processInvoiceApplication(@PathVariable long id,@Valid @RequestBody InvoiceProcessRequest request) {
        if(request.status()<1||request.status()>3)throw new IllegalArgumentException("开票处理状态不正确");
        if(request.status()==2&&(request.invoiceNo()==null||request.invoiceNo().isBlank()||request.invoiceFileUrl()==null||request.invoiceFileUrl().isBlank()))
            throw new IllegalArgumentException("已开具时必须填写发票号码和电子发票文件地址");
        if(request.status()==3&&(request.failureReason()==null||request.failureReason().isBlank()))
            throw new IllegalArgumentException("驳回时必须填写原因");
        int changed=jdbc.sql("""
          UPDATE invoice_application SET status=:status,invoice_no=:invoiceNo,invoice_file_url=:invoiceFileUrl,
            failure_reason=:failureReason,processed_at=NOW() WHERE id=:id AND status IN (0,1)
          """).param("status",request.status()).param("invoiceNo",request.invoiceNo())
          .param("invoiceFileUrl",request.invoiceFileUrl()).param("failureReason",request.failureReason()).param("id",id).update();
        if(changed==0)throw new IllegalArgumentException("开票申请不存在或已处理");
    }
    public record ProductRequest(@NotBlank String title,String model,@NotNull Long categoryId,@NotNull Long brandId,Integer selfOperated,
        String mainImage,String gallery,String summary,String detailHtml,
        String deliveryDescription,String afterSalesHtml,String spec,
      @DecimalMin("0") BigDecimal marketPrice,@DecimalMin("0") BigDecimal memberPrice,@Min(0) Integer stock,int status,
      Map<String,Object> attributeValues,List<SkuRequest> skus,String badgeType,Long badgePlatformId,String customBadge,List<Long> serviceOptionIds,
      String collectionPlatform,String collectionSourceUrl){
        public ProductRequest {
            long galleryCount=gallery==null?0:gallery.lines().filter(line->!line.isBlank()).count();
            if(galleryCount>6) throw new IllegalArgumentException("商品配图最多上传6张");
        }
        public int selfOperatedValue() { return selfOperated==null ? 0 : (selfOperated==0 ? 0 : 1); }
    }
    public record SkuRequest(Long id,String skuCode,Map<String,Object> specValues,String skuImage,String skuTitle,String skuGallery,
      BigDecimal marketPrice,BigDecimal memberPrice,int stock,int status){}
    public record CategoryRequest(@NotBlank String name,Long parentId,@Min(1) int level,
      @Min(0) int sortOrder,String icon,int status){}
    public record BatchSelfOperatedRequest(List<Long> ids,int selfOperated){}
    public record EnterpriseRequest(@NotBlank String name,@NotBlank String creditCode,@NotBlank String contactName,
      @NotBlank String contactPhone,String address,int status){}
    public record EnterpriseMemberRequest(@NotBlank String username,@NotBlank String realName,
      @NotBlank String phone,@NotBlank String roleCode,int status,String password){}
    public record AgreementRequest(@NotNull Long enterpriseId,@NotBlank String name,@NotNull @DecimalMin("0") BigDecimal amount,
      @NotBlank String effectiveDate,@NotBlank String expiryDate,int status){}
    public record StatusRequest(int status){}
    public record StockRequest(@Min(0) int stock){}
    public record OrderStatusRequest(int paymentStatus,int orderStatus){}
    public record ItemLogisticsRequest(int fulfillmentStatus,String logisticsCompany,
        String logisticsNo,String logisticsStatus){}
    public record RefundRequest(@NotNull @DecimalMin("0.01") BigDecimal refundAmount,
        @NotBlank String refundReason){}
    public record FinanceStatementStatusRequest(int status,String remark){}
    public record InvoiceProcessRequest(int status,String invoiceNo,String invoiceFileUrl,String failureReason){}
}
