package cn.govproc.supplychain.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
        var enterprises=jdbc.sql("""
          SELECT id FROM enterprise
          WHERE name=:name AND status=1 AND deleted_at IS NULL
          """).param("name",r.enterpriseName().trim()).query(Long.class).list();
        if(enterprises.isEmpty()) throw new IllegalArgumentException("未找到该企业，请核对企业全称");
        if(enterprises.size()>1) throw new IllegalArgumentException("企业名称不唯一，请联系平台管理员");
        long enterpriseId=enterprises.getFirst();
        long usernameExists=jdbc.sql("""
          SELECT COUNT(*) FROM enterprise_user
          WHERE username=:username AND deleted_at IS NULL
          """).param("username",r.username()).query(Long.class).single();
        if(usernameExists>0) throw new IllegalArgumentException("登录账号已存在，请更换账号");
        jdbc.sql("""
          INSERT INTO enterprise_user(enterprise_id,username,password_hash,real_name,phone,role_code,status)
          VALUES(:enterpriseId,:username,:password,:realName,:phone,'BUYER',1)
          """).params(Map.of("enterpriseId",enterpriseId,"username",r.username(),
          "password",encoder.encode(r.password()),"realName",r.realName(),"phone",r.phone())).update();
        long userId=jdbc.sql("SELECT id FROM enterprise_user WHERE enterprise_id=:enterpriseId AND username=:username AND deleted_at IS NULL")
          .params(Map.of("enterpriseId",enterpriseId,"username",r.username())).query(Long.class).single();
        issueSession(userId,response);
        return Map.of("userId",userId);
    }

    @PostMapping("/login")
    Map<String,Object> login(@Valid @RequestBody LoginRequest r,HttpServletResponse response) {
        var users=jdbc.sql("""
          SELECT u.id,u.password_hash AS passwordHash FROM enterprise_user u
          JOIN enterprise e ON e.id=u.enterprise_id
          WHERE u.username=:username AND u.status=1
            AND u.deleted_at IS NULL AND e.status=1 AND e.deleted_at IS NULL
          """).param("username",r.username()).query().listOfRows();
        var matched=users.stream()
          .filter(user->encoder.matches(r.password(),String.valueOf(user.get("passwordHash")))).toList();
        if(matched.isEmpty()) throw new IllegalArgumentException("账号或密码错误");
        if(matched.size()>1) throw new IllegalArgumentException("账号关联多个企业，请联系平台管理员处理");
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
    public record RegisterRequest(@NotBlank String enterpriseName,@NotBlank @Size(min=3,max=80) String username,
      @NotBlank @Size(min=8,max=72) String password,@NotBlank String realName,@NotBlank String phone){}
}
