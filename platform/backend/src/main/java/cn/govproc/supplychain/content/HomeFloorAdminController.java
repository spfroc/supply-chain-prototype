package cn.govproc.supplychain.content;

import cn.govproc.supplychain.common.PageSupport;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/content/home-floors")
public class HomeFloorAdminController {
    private static final Set<String> CONTENT_TYPES=Set.of("PRODUCT","SOLUTION","CATEGORY","CONTENT");
    private static final Set<String> RULES=Set.of("MANUAL","LATEST","SALES","VIEWS","CATEGORY","BRAND","PLATFORM","AGREEMENT");
    private static final Set<String> SCOPES=Set.of("ALL","WEB","H5");
    private final JdbcClient jdbc;
    public HomeFloorAdminController(JdbcClient jdbc){this.jdbc=jdbc;}

    @GetMapping
    Object list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize,
                @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status){
        String base="""
          SELECT f.id,f.title,f.subtitle,f.content_type AS contentType,f.selection_rule AS selectionRule,
                 f.reference_id AS referenceId,f.display_count AS displayCount,f.target_scope AS targetScope,
                 f.link_url AS linkUrl,f.sort_order AS sortOrder,f.status,f.updated_at AS updatedAt,
                 (SELECT COUNT(*) FROM home_floor_item i WHERE i.floor_id=f.id AND i.deleted_at IS NULL) AS itemCount
          FROM home_floor f WHERE f.deleted_at IS NULL
          """;
        return PageSupport.query(jdbc,base,"q.sortOrder,q.id",Map.of(),page,pageSize,keyword,status,
          List.of("title","subtitle","contentType","selectionRule"),"status");
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String,Object> create(@Valid @RequestBody FloorRequest r){validate(r); jdbc.sql("""
      INSERT INTO home_floor(title,subtitle,content_type,selection_rule,reference_id,display_count,target_scope,link_url,sort_order,status)
      VALUES(:title,:subtitle,:contentType,:selectionRule,:referenceId,:displayCount,:targetScope,:linkUrl,:sortOrder,:status)
      """).paramSource(r).update(); return Map.of("id",jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());}

    @PutMapping("/{id}") @Transactional
    void update(@PathVariable long id,@Valid @RequestBody FloorRequest r){validate(r); int changed=jdbc.sql("""
      UPDATE home_floor SET title=:title,subtitle=:subtitle,content_type=:contentType,selection_rule=:selectionRule,
        reference_id=:referenceId,display_count=:displayCount,target_scope=:targetScope,link_url=:linkUrl,
        sort_order=:sortOrder,status=:status WHERE id=:id AND deleted_at IS NULL
      """).param("id",id).param("title",r.title()).param("subtitle",r.subtitle())
        .param("contentType",r.contentType()).param("selectionRule",r.selectionRule()).param("referenceId",r.referenceId())
        .param("displayCount",r.displayCount()).param("targetScope",r.targetScope()).param("linkUrl",r.linkUrl())
        .param("sortOrder",r.sortOrder()).param("status",r.status()).update();
      if(changed==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"首页楼层不存在");}

    @GetMapping("/{id}/items")
    List<Map<String,Object>> items(@PathVariable long id){return jdbc.sql("""
      SELECT i.id,i.content_id AS contentId,i.sort_order AS sortOrder,
        CASE f.content_type WHEN 'PRODUCT' THEN p.title WHEN 'CATEGORY' THEN c.name ELSE pr.title END AS title,
        CASE f.content_type WHEN 'PRODUCT' THEN s.sku_code ELSE f.content_type END AS subtitle
      FROM home_floor_item i JOIN home_floor f ON f.id=i.floor_id
      LEFT JOIN product_sku s ON f.content_type='PRODUCT' AND s.id=i.content_id
      LEFT JOIN product_spu p ON p.id=s.spu_id
      LEFT JOIN category c ON f.content_type='CATEGORY' AND c.id=i.content_id
      LEFT JOIN portal_resource pr ON f.content_type IN ('SOLUTION','CONTENT') AND pr.id=i.content_id
      WHERE i.floor_id=:id AND i.deleted_at IS NULL ORDER BY i.sort_order,i.id
      """).param("id",id).query().listOfRows();}

    @PostMapping("/{id}/items") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String,Object> addItem(@PathVariable long id,@Valid @RequestBody ItemRequest r){
      jdbc.sql("""
        INSERT INTO home_floor_item(floor_id,content_id,sort_order) VALUES(:id,:contentId,:sortOrder)
        ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),sort_order=VALUES(sort_order),deleted_at=NULL
        """)
        .param("id",id).param("contentId",r.contentId()).param("sortOrder",r.sortOrder()).update();
      return Map.of("id",jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());}

    @DeleteMapping("/{floorId}/items/{itemId}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void removeItem(@PathVariable long floorId,@PathVariable long itemId){jdbc.sql("UPDATE home_floor_item SET deleted_at=NOW() WHERE id=:itemId AND floor_id=:floorId")
      .param("itemId",itemId).param("floorId",floorId).update();}

    private void validate(FloorRequest r){
      if(!CONTENT_TYPES.contains(r.contentType()))throw new IllegalArgumentException("不支持的楼层内容类型");
      if(!RULES.contains(r.selectionRule()))throw new IllegalArgumentException("不支持的选品规则");
      if(!SCOPES.contains(r.targetScope()))throw new IllegalArgumentException("不支持的展示端");
    }
    public record FloorRequest(@NotBlank String title,String subtitle,@NotBlank String contentType,@NotBlank String selectionRule,
      Long referenceId,@NotNull @Min(1) @Max(50) Integer displayCount,@NotBlank String targetScope,String linkUrl,
      @NotNull Integer sortOrder,@NotNull @Min(0) @Max(1) Integer status){}
    public record ItemRequest(@NotNull Long contentId,@NotNull Integer sortOrder){}
}
