package cn.govproc.supplychain.content;

import cn.govproc.supplychain.common.PageSupport;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/content/service-features")
public class ServiceFeatureAdminController {
  private final JdbcClient jdbc;
  public ServiceFeatureAdminController(JdbcClient jdbc){this.jdbc=jdbc;}

  @GetMapping
  Object list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize,
              @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status){
    String base="""
      SELECT id,image_url AS imageUrl,title,subtitle,sort_order AS sortOrder,status,updated_at AS updatedAt
      FROM portal_service_feature WHERE deleted_at IS NULL
      """;
    return PageSupport.query(jdbc,base,"q.sortOrder,q.id",Map.of(),page,pageSize,keyword,status,
      java.util.List.of("title","subtitle"),"status");
  }

  @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
  Map<String,Object> create(@Valid @RequestBody FeatureRequest r){jdbc.sql("""
    INSERT INTO portal_service_feature(image_url,title,subtitle,sort_order,status)
    VALUES(:imageUrl,:title,:subtitle,:sortOrder,:status)
    """).paramSource(r).update();return Map.of("id",jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());}

  @PutMapping("/{id}") @Transactional
  void update(@PathVariable long id,@Valid @RequestBody FeatureRequest r){int changed=jdbc.sql("""
    UPDATE portal_service_feature SET image_url=:imageUrl,title=:title,subtitle=:subtitle,sort_order=:sortOrder,status=:status
    WHERE id=:id AND deleted_at IS NULL
    """).params(Map.of("id",id,"imageUrl",r.imageUrl(),"title",r.title(),"subtitle",r.subtitle(),"sortOrder",r.sortOrder(),"status",r.status())).update();if(changed==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"服务保障项不存在");}

  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable long id){jdbc.sql("UPDATE portal_service_feature SET deleted_at=NOW(),status=0 WHERE id=:id AND deleted_at IS NULL").param("id",id).update();}

  public record FeatureRequest(@NotBlank String imageUrl,
    @NotBlank @Pattern(regexp="^[\\p{IsHan}]{4}$",message="标题必须为4个汉字") String title,
    @NotBlank @Pattern(regexp="^[\\p{IsHan}]{8,10}$",message="副标题必须为8至10个汉字") String subtitle,
    @NotNull Integer sortOrder,@NotNull Integer status){}
}
