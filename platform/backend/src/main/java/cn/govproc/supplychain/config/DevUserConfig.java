package cn.govproc.supplychain.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@Configuration
public class DevUserConfig {
    @Bean
    UserDetailsService users(JdbcClient jdbc) {
        return username -> jdbc.sql("""
            SELECT u.username,u.password_hash,
              GROUP_CONCAT(DISTINCT p.permission_code ORDER BY p.permission_code) AS permission_codes
            FROM sys_admin_user u
            LEFT JOIN sys_admin_user_role ur ON ur.user_id=u.id
            LEFT JOIN sys_role r ON r.id=ur.role_id AND r.status=1
            LEFT JOIN sys_role_permission rp ON rp.role_id=r.id
            LEFT JOIN sys_permission p ON p.id=rp.permission_id
            WHERE u.username=:username AND u.status=1 AND u.deleted_at IS NULL
            GROUP BY u.id
            """).param("username", username).query((rs, rowNum) ->
                User.withUsername(rs.getString("username"))
                    .password(rs.getString("password_hash"))
                    .authorities(java.util.Arrays.stream(String.valueOf(rs.getString("permission_codes"))
                      .split(",")).filter(code->!code.isBlank()&&!"null".equals(code))
                      .map(SimpleGrantedAuthority::new).toList())
                    .build()
            ).optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "后台账号或密码错误"));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
