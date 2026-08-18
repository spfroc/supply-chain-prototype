package cn.govproc.supplychain.content;

import cn.govproc.supplychain.common.PageSupport;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/content/help-links")
public class HelpLinkAdminController {
  private final JdbcClient jdbc;
  public HelpLinkAdminController(JdbcClient jdbc){this.jdbc=jdbc;}

  @GetMapping
  Object list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize,
              @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status){
    String base="""
      SELECT h.id,h.title,h.article_id AS articleId,h.icon,h.sort_order AS sortOrder,h.status,
        a.title AS articleTitle,CONCAT('/web/articles/',a.id) AS articleLink,h.updated_at AS updatedAt
      FROM portal_help_link h JOIN portal_resource a ON a.id=h.article_id AND a.resource_type='CONTENT' AND a.deleted_at IS NULL
      WHERE h.deleted_at IS NULL
      """;
    return PageSupport.query(jdbc,base,"q.sortOrder,q.id",Map.of(),page,pageSize,keyword,status,
      java.util.List.of("title","articleTitle","articleLink"),"status");
  }

  @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
  Map<String,Object> create(@Valid @RequestBody HelpLinkRequest r){requireArticle(r.articleId());jdbc.sql("""
    INSERT INTO portal_help_link(title,article_id,icon,sort_order,status)
    VALUES(:title,:articleId,:icon,:sortOrder,:status)
    """).paramSource(r).update();return Map.of("id",jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());}

  @PutMapping("/{id}") @Transactional
  void update(@PathVariable long id,@Valid @RequestBody HelpLinkRequest r){requireArticle(r.articleId());int changed=jdbc.sql("""
    UPDATE portal_help_link SET title=:title,article_id=:articleId,icon=:icon,sort_order=:sortOrder,status=:status
    WHERE id=:id AND deleted_at IS NULL
    """).params(Map.of("id",id,"title",r.title(),"articleId",r.articleId(),"icon",r.icon(),"sortOrder",r.sortOrder(),"status",r.status())).update();if(changed==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"服务链接不存在");}

  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable long id){jdbc.sql("UPDATE portal_help_link SET deleted_at=NOW(),status=0 WHERE id=:id AND deleted_at IS NULL").param("id",id).update();}

  private void requireArticle(long id){int count=jdbc.sql("SELECT COUNT(*) FROM portal_resource WHERE id=:id AND resource_type='CONTENT' AND deleted_at IS NULL")
    .param("id",id).query(Integer.class).single();if(count==0)throw new IllegalArgumentException("所选文章不存在或已删除");}
  public record HelpLinkRequest(@NotBlank String title,@NotNull Long articleId,@NotBlank String icon,
    @NotNull Integer sortOrder,@NotNull Integer status){}
}
