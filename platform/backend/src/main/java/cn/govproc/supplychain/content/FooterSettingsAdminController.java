package cn.govproc.supplychain.content;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/content/footer-settings")
public class FooterSettingsAdminController {
  private static final Map<String,String> KEYS=Map.ofEntries(
    Map.entry("aboutTitle","footer.aboutTitle"),Map.entry("officialTitle","footer.officialTitle"),
    Map.entry("serviceTitle","footer.serviceTitle"),Map.entry("contactTitle","footer.contactTitle"),
    Map.entry("contactEnabled","footer.contactEnabled"),
    Map.entry("about","footer.about"),Map.entry("address","footer.address"),Map.entry("copyrightYears","footer.copyrightYears"),
    Map.entry("companyName","footer.companyName"),Map.entry("icpFiling","platform.icpFiling"),
    Map.entry("telecomLicense","platform.telecomLicense"),Map.entry("policeFiling","platform.policeFiling"));
  private final JdbcClient jdbc;
  public FooterSettingsAdminController(JdbcClient jdbc){this.jdbc=jdbc;}
  @GetMapping Map<String,Object> get(){var result=new LinkedHashMap<String,Object>();KEYS.forEach((field,key)->{String value=
    jdbc.sql("SELECT config_value FROM system_config WHERE config_key=:key").param("key",key).query(String.class).optional().orElse("");
    result.put(field,"contactEnabled".equals(field)?Boolean.parseBoolean(value):value);});return result;}
  @PutMapping @Transactional void update(@Valid @RequestBody FooterRequest r){var values=Map.ofEntries(
    Map.entry("aboutTitle",r.aboutTitle()),Map.entry("officialTitle",r.officialTitle()),
    Map.entry("serviceTitle",r.serviceTitle()),Map.entry("contactTitle",r.contactTitle()),
    Map.entry("contactEnabled",String.valueOf(r.contactEnabled())),
    Map.entry("about",r.about()),Map.entry("address",r.address()),Map.entry("copyrightYears",r.copyrightYears()),Map.entry("companyName",r.companyName()),
    Map.entry("icpFiling",r.icpFiling()),Map.entry("telecomLicense",r.telecomLicense()),Map.entry("policeFiling",r.policeFiling()));
    values.forEach((field,value)->jdbc.sql("UPDATE system_config SET config_value=:value,updated_by=1 WHERE config_key=:key")
      .param("value",value.trim()).param("key",KEYS.get(field)).update());}
  public record FooterRequest(
    @NotBlank @Pattern(regexp="^[\\p{IsHan}]{2,6}$",message="栏目标题必须为2至6个汉字") String aboutTitle,
    @NotBlank @Pattern(regexp="^[\\p{IsHan}]{2,6}$",message="栏目标题必须为2至6个汉字") String officialTitle,
    @NotBlank @Pattern(regexp="^[\\p{IsHan}]{2,6}$",message="栏目标题必须为2至6个汉字") String serviceTitle,
    @NotBlank @Pattern(regexp="^[\\p{IsHan}]{2,6}$",message="栏目标题必须为2至6个汉字") String contactTitle,
    @NotBlank String about,@NotBlank String address,@NotBlank String copyrightYears,
    @NotBlank String companyName,@NotBlank String icpFiling,@NotBlank String telecomLicense,@NotBlank String policeFiling,
    boolean contactEnabled){}
}
