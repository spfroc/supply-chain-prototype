package cn.govproc.supplychain.content;

import cn.govproc.supplychain.common.PageSupport;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin/content/home-ads")
public class HomeAdAdminController {
  private final JdbcClient jdbc; public HomeAdAdminController(JdbcClient jdbc){this.jdbc=jdbc;}
  @GetMapping Object groups(@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="10")int pageSize,@RequestParam(defaultValue="")String keyword,@RequestParam(required=false)Integer status){
    String base="SELECT g.id,g.name,g.layout_type AS layoutType,g.placement,g.anchor_floor_id AS anchorFloorId,g.target_scope AS targetScope,g.sort_order AS sortOrder,g.status,DATE_FORMAT(g.starts_at,'%Y-%m-%dT%H:%i') AS startsAt,DATE_FORMAT(g.ends_at,'%Y-%m-%dT%H:%i') AS endsAt,(SELECT COUNT(*) FROM home_ad_item i WHERE i.group_id=g.id AND i.deleted_at IS NULL) AS itemCount FROM home_ad_group g WHERE g.deleted_at IS NULL";
    return PageSupport.query(jdbc,base,"q.sortOrder,q.id",Map.of(),page,pageSize,keyword,status,List.of("name","layoutType","placement"),"status");
  }
  @PostMapping @ResponseStatus(HttpStatus.CREATED) Map<String,Object> create(@RequestBody Map<String,Object> r){jdbc.sql("INSERT INTO home_ad_group(name,layout_type,placement,anchor_floor_id,target_scope,sort_order,status,starts_at,ends_at) VALUES(:name,:layoutType,:placement,:anchorFloorId,:targetScope,:sortOrder,:status,:startsAt,:endsAt)").paramSource(r).update();return Map.of("id",jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());}
  @PutMapping("/{id}") void update(@PathVariable long id,@RequestBody Map<String,Object> r){jdbc.sql("UPDATE home_ad_group SET name=:name,layout_type=:layoutType,placement=:placement,anchor_floor_id=:anchorFloorId,target_scope=:targetScope,sort_order=:sortOrder,status=:status,starts_at=:startsAt,ends_at=:endsAt WHERE id=:id AND deleted_at IS NULL").paramSource(params(r,"id",id)).update();}
  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional void remove(@PathVariable long id){jdbc.sql("UPDATE home_ad_item SET deleted_at=NOW() WHERE group_id=:id AND deleted_at IS NULL").param("id",id).update();jdbc.sql("UPDATE home_ad_group SET deleted_at=NOW() WHERE id=:id").param("id",id).update();}
  @GetMapping("/{id}/items") List<Map<String,Object>> items(@PathVariable long id){return jdbc.sql("SELECT id,title,web_image_url AS webImageUrl,h5_image_url AS h5ImageUrl,link_url AS linkUrl,open_target AS openTarget,sort_order AS sortOrder,status FROM home_ad_item WHERE group_id=:id AND deleted_at IS NULL ORDER BY sort_order,id").param("id",id).query().listOfRows();}
  @PostMapping("/{id}/items") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> add(@PathVariable long id,@RequestBody Map<String,Object> r){jdbc.sql("INSERT INTO home_ad_item(group_id,title,web_image_url,h5_image_url,link_url,open_target,sort_order,status) VALUES(:id,:title,:webImageUrl,:h5ImageUrl,:linkUrl,:openTarget,:sortOrder,:status)").paramSource(params(r,"id",id)).update();return Map.of("id",jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());}
  @PutMapping("/{groupId}/items/{id}") void edit(@PathVariable long groupId,@PathVariable long id,@RequestBody Map<String,Object> r){jdbc.sql("UPDATE home_ad_item SET title=:title,web_image_url=:webImageUrl,h5_image_url=:h5ImageUrl,link_url=:linkUrl,open_target=:openTarget,sort_order=:sortOrder,status=:status WHERE id=:id AND group_id=:groupId AND deleted_at IS NULL").paramSource(params(r,"id",id,"groupId",groupId)).update();}
  @DeleteMapping("/{groupId}/items/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void deleteItem(@PathVariable long groupId,@PathVariable long id){jdbc.sql("UPDATE home_ad_item SET deleted_at=NOW() WHERE id=:id AND group_id=:groupId").param("id",id).param("groupId",groupId).update();}
  private Map<String,Object> params(Map<String,Object> source,Object... values){Map<String,Object> result=new HashMap<>(source);for(int i=0;i<values.length;i+=2)result.put(String.valueOf(values[i]),values[i+1]);return result;}
}
