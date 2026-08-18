package cn.govproc.supplychain.content;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/content/contact-settings")
public class ContactSettingsAdminController {
  private final JdbcClient jdbc;
  public ContactSettingsAdminController(JdbcClient jdbc){this.jdbc=jdbc;}

  @GetMapping
  Map<String,String> get(){
    var result=new LinkedHashMap<String,String>();
    jdbc.sql("SELECT config_key,config_value FROM system_config WHERE config_key IN ('contact.landline','contact.mobile','contact.wechatQr','contact.email') ORDER BY id")
      .query((rs,n)->Map.entry(rs.getString(1),rs.getString(2))).list()
      .forEach(entry->result.put(entry.getKey().substring("contact.".length()),entry.getValue()));
    return result;
  }

  @PutMapping @Transactional
  void update(@Valid @RequestBody ContactRequest request){
    updateValue("contact.landline",request.landline());
    updateValue("contact.mobile",request.mobile());
    updateValue("contact.wechatQr",request.wechatQr());
    updateValue("contact.email",request.email());
  }
  private void updateValue(String key,String value){jdbc.sql("UPDATE system_config SET config_value=:value,updated_by=1 WHERE config_key=:key")
    .param("key",key).param("value",value.trim()).update();}
  public record ContactRequest(@NotBlank String landline,@NotBlank String mobile,
    @NotBlank String wechatQr,@NotBlank @Email String email){}
}
