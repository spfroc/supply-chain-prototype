package cn.govproc.supplychain.content;

import cn.govproc.supplychain.common.PageSupport;
import cn.govproc.supplychain.common.RichTextSanitizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/content")
public class ContentAdminController {
    private static final Set<String> TYPES = Set.of("NAVIGATION", "BANNER", "PLATFORM", "SOLUTION", "CONTENT");
    private final JdbcClient jdbc;
    private final RichTextSanitizer richTextSanitizer;

    public ContentAdminController(JdbcClient jdbc, RichTextSanitizer richTextSanitizer) {
        this.jdbc = jdbc;
        this.richTextSanitizer = richTextSanitizer;
    }

    @GetMapping("/{type}")
    Object list(@PathVariable String type,@RequestParam(required=false) Integer page,
                @RequestParam(defaultValue="10") int pageSize,@RequestParam(defaultValue="") String keyword,
                @RequestParam(required=false) Integer status) {
        String base="""
            SELECT id,title,subtitle,description,price_prefix AS pricePrefix,image_url AS imageUrl,mobile_image_url AS mobileImageUrl,link_url AS linkUrl,
                   sort_order AS sortOrder,status,created_at AS createdAt,updated_at AS updatedAt
            FROM portal_resource
            WHERE resource_type=:type AND deleted_at IS NULL
            """;
        var params=Map.of("type",normalize(type));
        if(page==null) {
            var rows=jdbc.sql(base+" ORDER BY sortOrder,id").params(params).query().listOfRows();
            return "CONTENT".equals(normalize(type)) ? richTextSanitizer.cleanRows(rows,"description") : rows;
        }
        var result=PageSupport.query(jdbc,base,"q.sortOrder,q.id",params,page,pageSize,keyword,status,
            List.of("title","subtitle","description","linkUrl"),"status");
        return "CONTENT".equals(normalize(type)) ? richTextSanitizer.cleanPage(result,"description") : result;
    }

    @PostMapping("/{type}") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String, Object> create(@PathVariable String type, @Valid @RequestBody ResourceRequest request) {
        jdbc.sql("""
            INSERT INTO portal_resource(resource_type,title,subtitle,description,price_prefix,image_url,mobile_image_url,link_url,sort_order,status)
            VALUES(:type,:title,:subtitle,:description,:pricePrefix,:imageUrl,:mobileImageUrl,:linkUrl,:sortOrder,:status)
            """).param("type", normalize(type)).param("title", request.title())
            .param("subtitle", request.subtitle()).param("description", description(type, request)).param("imageUrl", request.imageUrl())
            .param("mobileImageUrl", request.mobileImageUrl())
            .param("pricePrefix", pricePrefix(type, request))
            .param("linkUrl", request.linkUrl()).param("sortOrder", request.sortOrder())
            .param("status", request.status()).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        return Map.of("id", id);
    }

    @PutMapping("/{type}/{id}") @Transactional
    void update(@PathVariable String type, @PathVariable long id, @Valid @RequestBody ResourceRequest request) {
        int changed = jdbc.sql("""
            UPDATE portal_resource SET title=:title,subtitle=:subtitle,description=:description,image_url=:imageUrl,
                mobile_image_url=:mobileImageUrl,price_prefix=:pricePrefix,
                link_url=:linkUrl,sort_order=:sortOrder,status=:status
            WHERE id=:id AND resource_type=:type AND deleted_at IS NULL
            """).param("id", id).param("type", normalize(type)).param("title", request.title())
            .param("subtitle", request.subtitle()).param("description", description(type, request)).param("imageUrl", request.imageUrl())
            .param("mobileImageUrl", request.mobileImageUrl())
            .param("pricePrefix", pricePrefix(type, request))
            .param("linkUrl", request.linkUrl()).param("sortOrder", request.sortOrder())
            .param("status", request.status()).update();
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在");
    }

    @DeleteMapping("/{type}/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void delete(@PathVariable String type, @PathVariable long id) {
        int changed = jdbc.sql("""
            UPDATE portal_resource SET deleted_at=NOW()
            WHERE id=:id AND resource_type=:type AND deleted_at IS NULL
            """).param("id", id).param("type", normalize(type)).update();
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在");
    }

    @GetMapping("/platform/{platformId}/products")
    Object platformProducts(@PathVariable long platformId,@RequestParam(required=false) Integer page,
                            @RequestParam(defaultValue="10") int pageSize,@RequestParam(defaultValue="") String keyword,
                            @RequestParam(required=false) Integer status) {
        requirePlatform(platformId);
        String base="""
            SELECT pp.id,pp.platform_id AS platformId,pp.sku_id AS skuId,p.title,s.sku_code AS skuCode,
                   pp.platform_price AS platformPrice,pp.product_url AS productUrl,
                   pp.listing_status AS listingStatus,pp.click_count AS clickCount,pp.updated_at AS updatedAt
            FROM product_platform pp
            JOIN product_sku s ON s.id=pp.sku_id AND s.deleted_at IS NULL
            JOIN product_spu p ON p.id=s.spu_id AND p.deleted_at IS NULL
            WHERE pp.platform_id=:platformId AND pp.deleted_at IS NULL
            """;
        var params=Map.of("platformId",platformId);
        if(page==null) return jdbc.sql(base+" ORDER BY id DESC").params(params).query().listOfRows();
        return PageSupport.query(jdbc,base,"q.id DESC",params,page,pageSize,keyword,status,
          List.of("title","skuCode","productUrl"),"listingStatus");
    }

    @PostMapping("/platform/{platformId}/products") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String, Object> addPlatformProduct(@PathVariable long platformId, @Valid @RequestBody PlatformProductRequest request) {
        requirePlatform(platformId);
        requireSku(request.skuId());
        String productUrl=normalizeProductUrl(request.productUrl());
        jdbc.sql("""
            INSERT INTO product_platform(platform_id,sku_id,platform_price,product_url,listing_status,click_count)
            VALUES(:platformId,:skuId,:platformPrice,:productUrl,:listingStatus,0)
            ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),platform_price=VALUES(platform_price),
              product_url=VALUES(product_url),listing_status=VALUES(listing_status),deleted_at=NULL,updated_at=NOW()
            """).param("platformId", platformId).param("skuId", request.skuId())
            .param("platformPrice", request.platformPrice()).param("productUrl", productUrl)
            .param("listingStatus", request.listingStatus()).update();
        return Map.of("id", jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());
    }

    @PutMapping("/platform/{platformId}/products/{id}") @Transactional
    void updatePlatformProduct(@PathVariable long platformId, @PathVariable long id,
                               @Valid @RequestBody PlatformProductRequest request) {
        int changed=jdbc.sql("""
            UPDATE product_platform SET platform_price=:platformPrice,product_url=:productUrl,
                listing_status=:listingStatus
            WHERE id=:id AND platform_id=:platformId AND deleted_at IS NULL
            """).param("id", id).param("platformId", platformId)
            .param("platformPrice", request.platformPrice()).param("productUrl", normalizeProductUrl(request.productUrl()))
            .param("listingStatus", request.listingStatus()).update();
        if(changed==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "平台商品不存在");
    }

    private String normalizeProductUrl(String productUrl) {
        return productUrl==null ? "" : productUrl.trim();
    }

    private void requireSku(long skuId) {
        Integer count=jdbc.sql("SELECT COUNT(*) FROM product_sku WHERE id=:id AND deleted_at IS NULL")
          .param("id",skuId).query(Integer.class).single();
        if(count==0) throw new IllegalArgumentException("所选商品SKU不存在或已删除，请刷新商品列表后重试");
    }

    @DeleteMapping("/platform/{platformId}/products/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void deletePlatformProduct(@PathVariable long platformId,@PathVariable long id) {
        Long productId=jdbc.sql("""
            SELECT s.spu_id FROM product_platform pp JOIN product_sku s ON s.id=pp.sku_id
            WHERE pp.id=:id AND pp.platform_id=:platformId AND pp.deleted_at IS NULL
            """).param("id",id).param("platformId",platformId).query(Long.class).optional()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND, "平台商品不存在"));
        int changed=jdbc.sql("""
            UPDATE product_platform SET deleted_at=NOW()
            WHERE id=:id AND platform_id=:platformId AND deleted_at IS NULL
            """).param("id",id).param("platformId",platformId).update();
        if(changed==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "平台商品不存在");
        jdbc.sql("""
            UPDATE product_spu p SET p.badge_type=NULL,p.badge_platform_id=NULL,p.custom_badge=NULL
            WHERE p.id=:productId AND p.badge_type='PLATFORM' AND p.badge_platform_id=:platformId
              AND NOT EXISTS(SELECT 1 FROM product_platform pp JOIN product_sku s ON s.id=pp.sku_id
                WHERE s.spu_id=p.id AND pp.platform_id=:platformId AND pp.deleted_at IS NULL)
            """).param("productId",productId).param("platformId",platformId).update();
    }

    @GetMapping("/solution/{solutionId}/products")
    Object solutionProducts(@PathVariable long solutionId,@RequestParam(required=false) Integer page,
                            @RequestParam(defaultValue="10") int pageSize,@RequestParam(defaultValue="") String keyword) {
        requireSolution(solutionId);
        String base="""
            SELECT si.id,si.solution_id AS solutionId,si.sku_id AS skuId,p.title,
                   COALESCE(NULLIF(p.main_image,''),SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(p.gallery_json,'$.content')),'\n',1)) AS mainImage,
                   s.sku_code AS skuCode,s.member_price AS price,
                   s.stock-s.reserved_stock AS availableStock,si.default_quantity AS defaultQuantity,
                   si.required_item AS requiredItem,si.sort_order AS sortOrder,si.updated_at AS updatedAt
            FROM solution_item si
            JOIN product_sku s ON s.id=si.sku_id AND s.deleted_at IS NULL
            JOIN product_spu p ON p.id=s.spu_id AND p.deleted_at IS NULL
            WHERE si.solution_id=:solutionId AND si.deleted_at IS NULL
            """;
        var params=Map.of("solutionId",solutionId);
        if(page==null) return jdbc.sql(base+" ORDER BY sortOrder,id").params(params).query().listOfRows();
        return PageSupport.query(jdbc,base,"q.sortOrder,q.id",params,page,pageSize,keyword,null,
          List.of("title","skuCode"),null);
    }

    @PostMapping("/solution/{solutionId}/products") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String, Object> addSolutionProduct(@PathVariable long solutionId,
                                           @Valid @RequestBody SolutionProductRequest request) {
        requireSolution(solutionId);
        jdbc.sql("""
            INSERT INTO solution_item(solution_id,sku_id,default_quantity,required_item,sort_order)
            VALUES(:solutionId,:skuId,:defaultQuantity,:requiredItem,:sortOrder)
            ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),default_quantity=VALUES(default_quantity),
                required_item=VALUES(required_item),sort_order=VALUES(sort_order),deleted_at=NULL
            """).param("solutionId", solutionId).param("skuId", request.skuId())
            .param("defaultQuantity", request.defaultQuantity()).param("requiredItem", request.requiredItem())
            .param("sortOrder", request.sortOrder()).update();
        return Map.of("id", jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());
    }

    @PutMapping("/solution/{solutionId}/products/{id}") @Transactional
    void updateSolutionProduct(@PathVariable long solutionId, @PathVariable long id,
                               @Valid @RequestBody SolutionProductRequest request) {
        int changed = jdbc.sql("""
            UPDATE solution_item SET default_quantity=:defaultQuantity,required_item=:requiredItem,
                sort_order=:sortOrder
            WHERE id=:id AND solution_id=:solutionId AND deleted_at IS NULL
            """).param("id", id).param("solutionId", solutionId)
            .param("defaultQuantity", request.defaultQuantity()).param("requiredItem", request.requiredItem())
            .param("sortOrder", request.sortOrder()).update();
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "方案商品不存在");
    }

    @DeleteMapping("/solution/{solutionId}/products/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void deleteSolutionProduct(@PathVariable long solutionId, @PathVariable long id) {
        int changed = jdbc.sql("""
            UPDATE solution_item SET deleted_at=NOW()
            WHERE id=:id AND solution_id=:solutionId AND deleted_at IS NULL
            """).param("id", id).param("solutionId", solutionId).update();
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "方案商品不存在");
    }

    @GetMapping("/brands/list")
    Object brands(@RequestParam(required=false) Integer page,
                  @RequestParam(defaultValue="10") int pageSize,
                  @RequestParam(defaultValue="") String keyword,
                  @RequestParam(required=false) Integer status) {
        String base="""
            SELECT id,name,logo,description,sort_order AS sortOrder,status,created_at AS createdAt
            FROM brand WHERE deleted_at IS NULL
            """;
        if(page==null) return jdbc.sql(base+" ORDER BY sortOrder,id").query().listOfRows();
        return PageSupport.query(jdbc,base,"q.sortOrder,q.id",Map.of(),page,pageSize,keyword,status,
            List.of("name","description"),"status");
    }

    @PostMapping("/brands/list") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String, Object> createBrand(@Valid @RequestBody BrandRequest request) {
        String name = request.name().trim();
        Long existing = findBrandId(name);
        if (existing != null) {
            restoreBrandIfDeleted(existing, request);
            return Map.of("id", existing);
        }
        try {
            jdbc.sql("""
                INSERT INTO brand(name,logo,description,sort_order,status)
                VALUES(:name,:logo,:description,:sortOrder,:status)
                """).param("name", name).param("logo", request.logo())
                .param("description", request.description())
                .param("sortOrder", request.sortOrder()).param("status", request.status()).update();
            long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
            return Map.of("id", id);
        } catch (DataIntegrityViolationException exception) {
            Long id = findBrandId(name);
            if (id == null) {
                throw exception;
            }
            restoreBrandIfDeleted(id, request);
            return Map.of("id", id);
        }
    }

    @PutMapping("/brands/list/{id}") @Transactional
    void updateBrand(@PathVariable long id, @Valid @RequestBody BrandRequest request) {
        int changed = jdbc.sql("""
            UPDATE brand SET name=:name,logo=:logo,description=:description,sort_order=:sortOrder,status=:status
            WHERE id=:id AND deleted_at IS NULL
            """).param("id", id).param("name", request.name()).param("logo", request.logo())
            .param("description", request.description()).param("sortOrder", request.sortOrder())
            .param("status", request.status()).update();
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "品牌不存在");
    }

    @DeleteMapping("/brands/list/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void deleteBrand(@PathVariable long id) {
        Integer count = jdbc.sql("SELECT COUNT(*) FROM product_spu WHERE brand_id=:id AND deleted_at IS NULL")
            .param("id", id).query(Integer.class).single();
        if (count > 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "品牌已关联商品，请先停用");
        jdbc.sql("UPDATE brand SET deleted_at=NOW() WHERE id=:id AND deleted_at IS NULL").param("id", id).update();
    }

    private Long findBrandId(String name) {
        var rows = jdbc.sql("""
            SELECT id FROM brand WHERE name=:name
            ORDER BY (deleted_at IS NULL) DESC, id
            LIMIT 1
            """).param("name", name).query().listOfRows();
        if (rows.isEmpty()) {
            return null;
        }
        return ((Number) rows.get(0).get("id")).longValue();
    }

    private void restoreBrandIfDeleted(long id, BrandRequest request) {
        jdbc.sql("""
            UPDATE brand
            SET deleted_at=NULL,
                status=CASE WHEN status=0 THEN :status ELSE status END,
                logo=CASE WHEN logo IS NULL OR logo='' THEN :logo ELSE logo END,
                description=CASE WHEN description IS NULL OR description='' THEN :description ELSE description END
            WHERE id=:id AND deleted_at IS NOT NULL
            """).param("id", id).param("status", request.status())
            .param("logo", request.logo() == null ? "" : request.logo())
            .param("description", request.description() == null ? "" : request.description())
            .update();
    }

    private String normalize(String value) {
        String type = value.toUpperCase();
        if (!TYPES.contains(type)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的内容类型");
        return type;
    }

    private void requirePlatform(long id) {
        Integer count=jdbc.sql("""
            SELECT COUNT(*) FROM portal_resource
            WHERE id=:id AND resource_type='PLATFORM' AND deleted_at IS NULL
            """).param("id",id).query(Integer.class).single();
        if(count==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"平台不存在");
    }

    private void requireSolution(long id) {
        Integer count = jdbc.sql("""
            SELECT COUNT(*) FROM portal_resource
            WHERE id=:id AND resource_type='SOLUTION' AND deleted_at IS NULL
            """).param("id", id).query(Integer.class).single();
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "方案不存在");
    }

    private String pricePrefix(String type, ResourceRequest request) {
        if (!"PLATFORM".equals(normalize(type))) return null;
        String configured = request.pricePrefix() == null ? "" : request.pricePrefix().trim();
        if (!configured.isEmpty()) return configured;
        String derived = request.title().trim()
            .replace("企业采购", "").replace("企业购", "")
            .replace("采购平台", "").replace("平台", "").replace("商城", "").trim();
        return derived.isEmpty() ? request.title().trim() : derived;
    }

    private String description(String type, ResourceRequest request) {
        return "CONTENT".equals(normalize(type))
            ? richTextSanitizer.clean(request.description()) : request.description();
    }

    public record ResourceRequest(@NotBlank String title, String subtitle, String description, String pricePrefix, String imageUrl,
                                  String mobileImageUrl, String linkUrl,
                                  @NotNull Integer sortOrder, @NotNull Integer status) {}
    public record BrandRequest(@NotBlank String name, String logo, String description,
                               @NotNull Integer sortOrder, @NotNull Integer status) {}
    public record PlatformProductRequest(@NotNull Long skuId,
        @NotNull @DecimalMin("0") BigDecimal platformPrice,String productUrl,
        @NotNull @Min(0) @Max(1) Integer listingStatus) {}
    public record SolutionProductRequest(@NotNull Long skuId,
        @Min(1) @Max(9999) int defaultQuantity, @Min(0) @Max(1) int requiredItem,
        @NotNull Integer sortOrder) {}
}
