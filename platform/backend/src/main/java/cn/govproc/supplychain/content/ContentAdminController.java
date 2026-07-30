package cn.govproc.supplychain.content;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/content")
public class ContentAdminController {
    private static final Set<String> TYPES = Set.of("NAVIGATION", "BANNER", "PLATFORM", "SOLUTION", "CONTENT");
    private final JdbcClient jdbc;

    public ContentAdminController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/{type}")
    List<Map<String, Object>> list(@PathVariable String type) {
        return jdbc.sql("""
            SELECT id,title,subtitle,image_url AS imageUrl,link_url AS linkUrl,
                   sort_order AS sortOrder,status,created_at AS createdAt,updated_at AS updatedAt
            FROM portal_resource
            WHERE resource_type=:type AND deleted_at IS NULL
            ORDER BY sort_order,id
            """).param("type", normalize(type)).query().listOfRows();
    }

    @PostMapping("/{type}") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String, Object> create(@PathVariable String type, @Valid @RequestBody ResourceRequest request) {
        jdbc.sql("""
            INSERT INTO portal_resource(resource_type,title,subtitle,image_url,link_url,sort_order,status)
            VALUES(:type,:title,:subtitle,:imageUrl,:linkUrl,:sortOrder,:status)
            """).param("type", normalize(type)).param("title", request.title())
            .param("subtitle", request.subtitle()).param("imageUrl", request.imageUrl())
            .param("linkUrl", request.linkUrl()).param("sortOrder", request.sortOrder())
            .param("status", request.status()).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        return Map.of("id", id);
    }

    @PutMapping("/{type}/{id}") @Transactional
    void update(@PathVariable String type, @PathVariable long id, @Valid @RequestBody ResourceRequest request) {
        int changed = jdbc.sql("""
            UPDATE portal_resource SET title=:title,subtitle=:subtitle,image_url=:imageUrl,
                link_url=:linkUrl,sort_order=:sortOrder,status=:status
            WHERE id=:id AND resource_type=:type AND deleted_at IS NULL
            """).param("id", id).param("type", normalize(type)).param("title", request.title())
            .param("subtitle", request.subtitle()).param("imageUrl", request.imageUrl())
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
    List<Map<String, Object>> platformProducts(@PathVariable long platformId) {
        requirePlatform(platformId);
        return jdbc.sql("""
            SELECT pp.id,pp.platform_id AS platformId,pp.sku_id AS skuId,p.title,s.sku_code AS skuCode,
                   pp.platform_price AS platformPrice,pp.product_url AS productUrl,
                   pp.listing_status AS listingStatus,pp.click_count AS clickCount,pp.updated_at AS updatedAt
            FROM product_platform pp
            JOIN product_sku s ON s.id=pp.sku_id AND s.deleted_at IS NULL
            JOIN product_spu p ON p.id=s.spu_id AND p.deleted_at IS NULL
            WHERE pp.platform_id=:platformId AND pp.deleted_at IS NULL
            ORDER BY pp.id DESC
            """).param("platformId", platformId).query().listOfRows();
    }

    @PostMapping("/platform/{platformId}/products") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String, Object> addPlatformProduct(@PathVariable long platformId, @Valid @RequestBody PlatformProductRequest request) {
        requirePlatform(platformId);
        jdbc.sql("""
            INSERT INTO product_platform(platform_id,sku_id,platform_price,product_url,listing_status,click_count)
            VALUES(:platformId,:skuId,:platformPrice,:productUrl,:listingStatus,0)
            """).param("platformId", platformId).param("skuId", request.skuId())
            .param("platformPrice", request.platformPrice()).param("productUrl", request.productUrl())
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
            .param("platformPrice", request.platformPrice()).param("productUrl", request.productUrl())
            .param("listingStatus", request.listingStatus()).update();
        if(changed==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "平台商品不存在");
    }

    @DeleteMapping("/platform/{platformId}/products/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void deletePlatformProduct(@PathVariable long platformId,@PathVariable long id) {
        int changed=jdbc.sql("""
            UPDATE product_platform SET deleted_at=NOW()
            WHERE id=:id AND platform_id=:platformId AND deleted_at IS NULL
            """).param("id",id).param("platformId",platformId).update();
        if(changed==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "平台商品不存在");
    }

    @GetMapping("/brands/list")
    List<Map<String, Object>> brands() {
        return jdbc.sql("""
            SELECT id,name,logo,description,sort_order AS sortOrder,status,created_at AS createdAt
            FROM brand WHERE deleted_at IS NULL ORDER BY sort_order,id
            """).query().listOfRows();
    }

    @PostMapping("/brands/list") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String, Object> createBrand(@Valid @RequestBody BrandRequest request) {
        jdbc.sql("""
            INSERT INTO brand(name,logo,description,sort_order,status)
            VALUES(:name,:logo,:description,:sortOrder,:status)
            """).paramSource(request).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        return Map.of("id", id);
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

    public record ResourceRequest(@NotBlank String title, String subtitle, String imageUrl, String linkUrl,
                                  @NotNull Integer sortOrder, @NotNull Integer status) {}
    public record BrandRequest(@NotBlank String name, String logo, String description,
                               @NotNull Integer sortOrder, @NotNull Integer status) {}
    public record PlatformProductRequest(@NotNull Long skuId,
        @NotNull @DecimalMin("0") BigDecimal platformPrice,@NotBlank String productUrl,
        @NotNull Integer listingStatus) {}
}
