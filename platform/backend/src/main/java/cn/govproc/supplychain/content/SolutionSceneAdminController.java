package cn.govproc.supplychain.content;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/content/solution-scenes")
public class SolutionSceneAdminController {
  private final JdbcClient jdbc;
  public SolutionSceneAdminController(JdbcClient jdbc){this.jdbc=jdbc;}
  @GetMapping List<Map<String,Object>> list(){return jdbc.sql("""
    SELECT s.id,s.name,s.description,s.sort_order AS sortOrder,s.status,COUNT(p.id) AS solutionCount
    FROM solution_scene s LEFT JOIN portal_resource p ON p.scene_id=s.id AND p.resource_type='SOLUTION' AND p.deleted_at IS NULL
    WHERE s.deleted_at IS NULL GROUP BY s.id ORDER BY s.sort_order,s.id
    """).query().listOfRows();}
  @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional Map<String,Object> create(@Valid @RequestBody Request r){
    jdbc.sql("INSERT INTO solution_scene(name,description,sort_order,status) VALUES(:name,:description,:sortOrder,:status)")
      .param("name",r.name().trim()).param("description",value(r.description())).param("sortOrder",r.sortOrder()).param("status",r.status()).update();
    return Map.of("id",jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());}
  @PutMapping("/{id}") @Transactional void update(@PathVariable long id,@Valid @RequestBody Request r){
    int changed=jdbc.sql("UPDATE solution_scene SET name=:name,description=:description,sort_order=:sortOrder,status=:status WHERE id=:id AND deleted_at IS NULL")
      .param("id",id).param("name",r.name().trim()).param("description",value(r.description())).param("sortOrder",r.sortOrder()).param("status",r.status()).update();
    if(changed==0)throw new IllegalArgumentException("应用场景不存在");}
  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional void delete(@PathVariable long id){
    long used=jdbc.sql("SELECT COUNT(*) FROM portal_resource WHERE scene_id=:id AND resource_type='SOLUTION' AND deleted_at IS NULL").param("id",id).query(Long.class).single();
    if(used>0)throw new IllegalArgumentException("该场景已关联方案，不能删除");
    jdbc.sql("UPDATE solution_scene SET deleted_at=NOW(),status=0 WHERE id=:id AND deleted_at IS NULL").param("id",id).update();}
  private String value(String value){return value==null?"":value.trim();}
  public record Request(@NotBlank String name,String description,@NotNull Integer sortOrder,@NotNull Integer status){}
}
