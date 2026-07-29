package cn.govproc.supplychain.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ClientAuthService {
    public static final String COOKIE_NAME = "client_session";
    private static final String REQUEST_KEY = ClientAuthService.class.getName()+".current";
    private final JdbcClient jdbc;

    public ClientAuthService(JdbcClient jdbc) { this.jdbc=jdbc; }

    public CurrentUser current() {
        var attributes=(ServletRequestAttributes)RequestContextHolder.currentRequestAttributes();
        HttpServletRequest request=attributes.getRequest();
        Object cached=request.getAttribute(REQUEST_KEY);
        if(cached instanceof CurrentUser user) return user;
        String token=null;
        if(request.getCookies()!=null) for(Cookie cookie:request.getCookies())
            if(COOKIE_NAME.equals(cookie.getName())) token=cookie.getValue();
        if(token==null||token.isBlank()) throw unauthorized();
        var rows=jdbc.sql("""
          SELECT u.id AS userId,u.enterprise_id AS enterpriseId,u.username,u.real_name AS realName,
            u.phone,u.role_code AS roleCode,e.name AS enterpriseName
          FROM client_session s JOIN enterprise_user u ON u.id=s.user_id
          JOIN enterprise e ON e.id=u.enterprise_id
          WHERE s.token_hash=:tokenHash AND s.expires_at>NOW() AND u.status=1
            AND u.deleted_at IS NULL AND e.status=1 AND e.deleted_at IS NULL
          """).param("tokenHash",hash(token)).query().listOfRows();
        if(rows.isEmpty()) throw unauthorized();
        Map<String,Object> row=rows.getFirst();
        CurrentUser user=new CurrentUser(((Number)row.get("userId")).longValue(),
          ((Number)row.get("enterpriseId")).longValue(),String.valueOf(row.get("username")),
          String.valueOf(row.get("realName")),String.valueOf(row.get("phone")),
          String.valueOf(row.get("roleCode")),String.valueOf(row.get("enterpriseName")));
        request.setAttribute(REQUEST_KEY,user);
        return user;
    }

    public static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
              .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch(Exception e) { throw new IllegalStateException(e); }
    }

    public static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED,"请先登录");
    }

    public record CurrentUser(long userId,long enterpriseId,String username,String realName,
      String phone,String roleCode,String enterpriseName) {}
}
