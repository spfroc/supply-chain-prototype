package cn.govproc.supplychain.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@Configuration
public class DevUserConfig {
    @Bean
    UserDetailsService users(JdbcClient jdbc) {
        return username -> jdbc.sql("""
            SELECT username,password_hash FROM sys_admin_user
            WHERE username=:username AND status=1 AND deleted_at IS NULL
            """).param("username", username).query((rs, rowNum) ->
                User.withUsername(rs.getString("username"))
                    .password(rs.getString("password_hash"))
                    .roles("ADMIN")
                    .build()
            ).optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "后台账号或密码错误"));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
