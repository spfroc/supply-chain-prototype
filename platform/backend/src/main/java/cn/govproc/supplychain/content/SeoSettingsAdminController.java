package cn.govproc.supplychain.content;
import jakarta.validation.Valid;import jakarta.validation.constraints.NotBlank;import java.util.*;import org.springframework.jdbc.core.simple.JdbcClient;import org.springframework.transaction.annotation.Transactional;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/admin/content/seo-settings")
public class SeoSettingsAdminController {private final JdbcClient jdbc;public SeoSettingsAdminController(JdbcClient jdbc){this.jdbc=jdbc;}
 private static final Map<String,String> K=Map.of("title","seo.title","description","seo.description","keywords","seo.keywords","geoKeywords","seo.geoKeywords","organizationName","seo.organizationName");
 @GetMapping Map<String,String> get(){var r=new LinkedHashMap<String,String>();K.forEach((f,k)->r.put(f,jdbc.sql("SELECT config_value FROM system_config WHERE config_key=:k").param("k",k).query(String.class).optional().orElse("")));return r;}
 @PutMapping @Transactional void update(@Valid @RequestBody SeoRequest r){var v=Map.of("title",r.title(),"description",r.description(),"keywords",r.keywords(),"geoKeywords",r.geoKeywords(),"organizationName",r.organizationName());v.forEach((f,x)->jdbc.sql("UPDATE system_config SET config_value=:v WHERE config_key=:k").param("v",x.trim()).param("k",K.get(f)).update());}
 public record SeoRequest(@NotBlank String title,@NotBlank String description,@NotBlank String keywords,@NotBlank String geoKeywords,@NotBlank String organizationName){}
}
