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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/content/home-floors")
public class HomeFloorAdminController {
    private static final Set<String> CONTENT_TYPES=Set.of("PRODUCT","SOLUTION","CATEGORY","CONTENT","BRAND_CATEGORY");
    private static final Set<String> RULES=Set.of("MANUAL","LATEST","SALES","VIEWS","CATEGORY","BRAND","PLATFORM","AGREEMENT");
    private static final Set<String> SCOPES=Set.of("ALL","WEB","H5");
    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper=new ObjectMapper();
    public HomeFloorAdminController(JdbcClient jdbc){this.jdbc=jdbc;}

    @GetMapping
    Object list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize,
                @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status){
        String base="""
          SELECT f.id,f.title,f.subtitle,f.content_type AS contentType,f.selection_rule AS selectionRule,
                 f.reference_id AS referenceId,f.display_count AS displayCount,f.target_scope AS targetScope,
                 f.link_url AS linkUrl,f.brand_groups_json AS brandGroups,f.sort_order AS sortOrder,f.status,f.updated_at AS updatedAt,
                 (SELECT COUNT(*) FROM home_floor_item i WHERE i.floor_id=f.id AND i.deleted_at IS NULL) AS itemCount
          FROM home_floor f WHERE f.deleted_at IS NULL
          """;
        return PageSupport.query(jdbc,base,"q.sortOrder,q.id",Map.of(),page,pageSize,keyword,status,
          List.of("title","subtitle","contentType","selectionRule"),"status");
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String,Object> create(@Valid @RequestBody FloorRequest r){validate(r); jdbc.sql("""
      INSERT INTO home_floor(title,subtitle,content_type,selection_rule,reference_id,display_count,target_scope,link_url,brand_groups_json,sort_order,status)
      VALUES(:title,:subtitle,:contentType,:selectionRule,:referenceId,:displayCount,:targetScope,:linkUrl,:brandGroups,:sortOrder,:status)
      """).param("title",r.title()).param("subtitle",r.subtitle()).param("contentType",r.contentType())
        .param("selectionRule",r.selectionRule()).param("referenceId",r.referenceId()).param("displayCount",r.displayCount())
        .param("targetScope",r.targetScope()).param("linkUrl",r.linkUrl()).param("brandGroups",brandGroupsJson(r))
        .param("sortOrder",r.sortOrder()).param("status",r.status()).update(); long id=jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
      replaceItems(id,r); return Map.of("id",id);}

    @PutMapping("/{id}") @Transactional
    void update(@PathVariable long id,@Valid @RequestBody FloorRequest r){validate(r); int changed=jdbc.sql("""
      UPDATE home_floor SET title=:title,subtitle=:subtitle,content_type=:contentType,selection_rule=:selectionRule,
        reference_id=:referenceId,display_count=:displayCount,target_scope=:targetScope,link_url=:linkUrl,brand_groups_json=:brandGroups,
        sort_order=:sortOrder,status=:status WHERE id=:id AND deleted_at IS NULL
      """).param("id",id).param("title",r.title()).param("subtitle",r.subtitle())
        .param("contentType",r.contentType()).param("selectionRule",r.selectionRule()).param("referenceId",r.referenceId())
        .param("displayCount",r.displayCount()).param("targetScope",r.targetScope()).param("linkUrl",r.linkUrl())
        .param("brandGroups",brandGroupsJson(r))
        .param("sortOrder",r.sortOrder()).param("status",r.status()).update();
      if(changed==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"首页楼层不存在");
      replaceItems(id,r);}

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
      if("MANUAL".equals(r.selectionRule())&&"PRODUCT".equals(r.contentType())&&(r.contentIds()==null||r.contentIds().isEmpty()))
        throw new IllegalArgumentException("手动选择商品时至少选择一个商品");
      if("BRAND_CATEGORY".equals(r.contentType())){
        if(r.brandGroups()==null||r.brandGroups().isEmpty())throw new IllegalArgumentException("品牌分类楼层至少需要一个分类");
        long total=r.brandGroups().stream().filter(java.util.Objects::nonNull).flatMap(g->g.brands()==null?java.util.stream.Stream.empty():g.brands().stream()).map(BrandItemRequest::brandId).filter(java.util.Objects::nonNull).distinct().count();
        if(total<4)throw new IllegalArgumentException("品牌分类楼层至少选择 4 个品牌");
      }
    }
    private String brandGroupsJson(FloorRequest r){
      if(!"BRAND_CATEGORY".equals(r.contentType()))return null;
      try{return objectMapper.writeValueAsString(r.brandGroups());}catch(JsonProcessingException e){throw new IllegalArgumentException("品牌分类配置格式不正确");}
    }
    private void replaceItems(long floorId,FloorRequest r){
      jdbc.sql("UPDATE home_floor_item SET deleted_at=NOW() WHERE floor_id=:floorId AND deleted_at IS NULL")
        .param("floorId",floorId).update();
      if(!"MANUAL".equals(r.selectionRule())||r.contentIds()==null)return;
      int sortOrder=0;
      for(Long contentId:r.contentIds().stream().filter(java.util.Objects::nonNull).distinct().toList()){
        if("PRODUCT".equals(r.contentType())){
          int count=jdbc.sql("SELECT COUNT(*) FROM product_sku WHERE id=:id AND status=1 AND deleted_at IS NULL")
            .param("id",contentId).query(Integer.class).single();
          if(count==0)throw new IllegalArgumentException("所选商品不存在、已下架或已删除");
        }
        if("CONTENT".equals(r.contentType())){
          int count=jdbc.sql("SELECT COUNT(*) FROM portal_resource WHERE id=:id AND resource_type='CONTENT' AND status=1 AND deleted_at IS NULL")
            .param("id",contentId).query(Integer.class).single();
          if(count==0)throw new IllegalArgumentException("所选文章不存在、未发布或已删除");
        }
        jdbc.sql("""
          INSERT INTO home_floor_item(floor_id,content_id,sort_order) VALUES(:floorId,:contentId,:sortOrder)
          ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order),deleted_at=NULL
          """).param("floorId",floorId).param("contentId",contentId).param("sortOrder",sortOrder++).update();
      }
    }
    public record FloorRequest(@NotBlank String title,String subtitle,@NotBlank String contentType,@NotBlank String selectionRule,
      Long referenceId,@NotNull @Min(1) @Max(50) Integer displayCount,@NotBlank String targetScope,String linkUrl,
      @NotNull Integer sortOrder,@NotNull @Min(0) @Max(1) Integer status,List<Long> contentIds,List<BrandGroupRequest> brandGroups){}
    public record BrandGroupRequest(@NotNull Long categoryId,String title,List<BrandItemRequest> brands){}
    public record BrandItemRequest(@NotNull Long brandId,String linkUrl){}
    public record ItemRequest(@NotNull Long contentId,@NotNull Integer sortOrder){}
}
