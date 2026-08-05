package cn.govproc.supplychain.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class ClientAuthController {
    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final ClientAuthService auth;
    public ClientAuthController(JdbcClient jdbc,PasswordEncoder encoder,ClientAuthService auth) {
        this.jdbc=jdbc;this.encoder=encoder;this.auth=auth;
    }

    @GetMapping("/enterprises")
    List<Map<String,Object>> enterprises() {
        return jdbc.sql("SELECT id,name,credit_code AS creditCode FROM enterprise WHERE status=1 AND deleted_at IS NULL ORDER BY name")
          .query().listOfRows();
    }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String,Object> register(@Valid @RequestBody RegisterRequest r,HttpServletResponse response) {
        String enterpriseName=r.enterpriseName().trim();
        String creditCode=r.creditCode().trim().toUpperCase();
        String username=r.username().trim();
        String phone=r.phone().trim();
        long usernameExists=jdbc.sql("""
          SELECT COUNT(*) FROM enterprise_user
          WHERE username=:username AND deleted_at IS NULL
          """).param("username",username).query(Long.class).single();
        if(usernameExists>0) throw new IllegalArgumentException("登录账号已存在，请更换账号");
        long phoneExists=jdbc.sql("""
          SELECT COUNT(*) FROM enterprise_user
          WHERE phone=:phone AND deleted_at IS NULL
          """).param("phone",phone).query(Long.class).single();
        if(phoneExists>0) throw new IllegalArgumentException("手机号码已绑定账号，请直接登录或更换手机号码");

        var enterprises=jdbc.sql("""
          SELECT id,name,credit_code AS creditCode FROM enterprise
          WHERE (name=:name OR credit_code=:creditCode) AND deleted_at IS NULL
          """).params(Map.of("name",enterpriseName,"creditCode",creditCode)).query().listOfRows();
        var exactMatch=enterprises.stream().filter(row->enterpriseName.equals(String.valueOf(row.get("name")))
          && creditCode.equalsIgnoreCase(String.valueOf(row.get("creditCode")))).findFirst();
        if(exactMatch.isEmpty() && !enterprises.isEmpty())
            throw new IllegalArgumentException("企业名称与统一社会信用代码不匹配，请核对后重试");

        boolean newEnterprise=exactMatch.isEmpty();
        long enterpriseId;
        if(newEnterprise) {
            jdbc.sql("""
              INSERT INTO enterprise(name,credit_code,contact_name,contact_phone,audit_status,status)
              VALUES(:name,:creditCode,:contactName,:contactPhone,2,1)
              """).params(Map.of("name",enterpriseName,"creditCode",creditCode,
                "contactName",r.realName().trim(),"contactPhone",phone)).update();
            enterpriseId=jdbc.sql("SELECT id FROM enterprise WHERE credit_code=:creditCode AND deleted_at IS NULL")
              .param("creditCode",creditCode).query(Long.class).single();
        } else {
            var enterprise=exactMatch.get();
            enterpriseId=((Number)enterprise.get("id")).longValue();
            long enabled=jdbc.sql("SELECT COUNT(*) FROM enterprise WHERE id=:id AND status=1 AND deleted_at IS NULL")
              .param("id",enterpriseId).query(Long.class).single();
            if(enabled==0) throw new IllegalArgumentException("该企业当前已停用，请联系平台管理员");
        }
        String roleCode=newEnterprise?"ENTERPRISE_ADMIN":"BUYER";
        int status=newEnterprise?1:0;
        jdbc.sql("""
          INSERT INTO enterprise_user(enterprise_id,username,password_hash,real_name,phone,role_code,status)
          VALUES(:enterpriseId,:username,:password,:realName,:phone,:roleCode,:status)
          """).params(Map.of("enterpriseId",enterpriseId,"username",username,
          "password",encoder.encode(r.password()),"realName",r.realName().trim(),"phone",phone,
          "roleCode",roleCode,"status",status)).update();
        long userId=jdbc.sql("SELECT id FROM enterprise_user WHERE enterprise_id=:enterpriseId AND username=:username AND deleted_at IS NULL")
          .params(Map.of("enterpriseId",enterpriseId,"username",username)).query(Long.class).single();
        if(newEnterprise) issueSession(userId,response);
        return Map.of("userId",userId,"enterpriseId",enterpriseId,"primaryAccount",newEnterprise,
          "pendingApproval",!newEnterprise,"message",newEnterprise
            ?"企业及主账号已创建":"注册申请已提交，请等待企业管理员启用账号");
    }

    @PostMapping("/login")
    Map<String,Object> login(@Valid @RequestBody LoginRequest r,HttpServletResponse response) {
        var users=jdbc.sql("""
          SELECT u.id,u.password_hash AS passwordHash FROM enterprise_user u
          JOIN enterprise e ON e.id=u.enterprise_id
          WHERE (u.username=:identifier OR u.phone=:identifier) AND u.status=1
            AND u.deleted_at IS NULL AND e.status=1 AND e.deleted_at IS NULL
          """).param("identifier",r.username().trim()).query().listOfRows();
        var matched=users.stream()
          .filter(user->encoder.matches(r.password(),String.valueOf(user.get("passwordHash")))).toList();
        if(matched.isEmpty()) throw new IllegalArgumentException("账号、手机号或密码错误");
        if(matched.size()>1) throw new IllegalArgumentException("登录信息关联多个企业，请联系平台管理员处理");
        long userId=((Number)matched.getFirst().get("id")).longValue();
        issueSession(userId,response);
        return Map.of("userId",userId);
    }

    @GetMapping("/me")
    ClientAuthService.CurrentUser me() { return auth.current(); }

    @GetMapping("/session")
    Map<String,Object> session() {
        try { return Map.of("authenticated",true,"user",auth.current()); }
        catch(org.springframework.web.server.ResponseStatusException exception) {
            return Map.of("authenticated",false);
        }
    }

    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request,HttpServletResponse response) {
        if(request.getCookies()!=null) for(Cookie cookie:request.getCookies())
            if(ClientAuthService.COOKIE_NAME.equals(cookie.getName()))
                jdbc.sql("DELETE FROM client_session WHERE token_hash=:hash")
                  .param("hash",ClientAuthService.hash(cookie.getValue())).update();
        Cookie cookie=new Cookie(ClientAuthService.COOKIE_NAME,"");
        cookie.setHttpOnly(true);cookie.setPath("/");cookie.setMaxAge(0);cookie.setAttribute("SameSite","Lax");
        response.addCookie(cookie);
    }

    private void issueSession(long userId,HttpServletResponse response) {
        String token=UUID.randomUUID()+"."+UUID.randomUUID();
        jdbc.sql("DELETE FROM client_session WHERE expires_at<=NOW()").update();
        jdbc.sql("INSERT INTO client_session(token_hash,user_id,expires_at) VALUES(:hash,:userId,DATE_ADD(NOW(),INTERVAL 7 DAY))")
          .params(Map.of("hash",ClientAuthService.hash(token),"userId",userId)).update();
        Cookie cookie=new Cookie(ClientAuthService.COOKIE_NAME,token);
        cookie.setHttpOnly(true);cookie.setPath("/");cookie.setMaxAge((int)Duration.ofDays(7).toSeconds());
        cookie.setSecure(false);cookie.setAttribute("SameSite","Lax");response.addCookie(cookie);
    }

    public record LoginRequest(@NotBlank String username,@NotBlank String password){}
    public record RegisterRequest(@NotBlank String enterpriseName,
      @NotBlank @Pattern(regexp="[0-9A-Z]{18}",message="请输入正确的18位统一社会信用代码") String creditCode,
      @NotBlank @Size(min=3,max=80) String username,@NotBlank @Size(min=8,max=72) String password,
      @NotBlank String realName,@NotBlank @Pattern(regexp="1\\d{10}",message="请输入11位手机号码") String phone){}
}
