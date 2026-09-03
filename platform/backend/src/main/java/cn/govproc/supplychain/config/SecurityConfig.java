package cn.govproc.supplychain.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.jdbc.core.simple.JdbcClient;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JdbcClient jdbc,
                                            cn.govproc.supplychain.auth.LoginAttemptService loginAttempts) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/error", "/actuator/health/**", "/api/openapi/**", "/api/docs/**", "/api/public/**", "/api/auth/**", "/api/client/**").permitAll()
                .requestMatchers("/api/admin/system/me").authenticated()
                .requestMatchers("/api/admin/system/summary").hasAuthority("dashboard:view")
                .requestMatchers("/api/admin/system/users/**").hasAuthority("system:user")
                .requestMatchers("/api/admin/system/roles/**","/api/admin/system/permissions/**").hasAuthority("system:role")
                .requestMatchers("/api/admin/system/configs/**","/api/admin/system/options/**",
                  "/api/admin/system/option-groups/**","/api/admin/system/sms/**").hasAuthority("system:config")
                .requestMatchers("/api/admin/system/logs/**").hasAuthority("system:log")
                .requestMatchers("/api/admin/business/product-associations").hasAnyAuthority("product:manage","agreement:manage")
                .requestMatchers("/api/admin/business/agreements","/api/admin/agreements/**").hasAnyAuthority("product:manage","agreement:manage")
                .requestMatchers("/api/admin/content/bank-accounts/**").hasAnyAuthority("system:config","product:manage")
                .requestMatchers("/api/admin/business/products/**","/api/admin/business/product-service-options","/api/admin/business/product-badge-options","/api/admin/business/product-default-stock","/api/admin/business/product-content-templates","/api/admin/business/categories/**",
                  "/api/admin/business/attributes/**","/api/admin/business/uploads/**",
                  "/api/admin/content/**").hasAuthority("product:manage")
                .requestMatchers("/api/admin/business/enterprises/**",
                  "/api/admin/business/enterprise-users/**").hasAuthority("enterprise:manage")
                .requestMatchers("/api/admin/business/agreements/**","/api/admin/agreements/**").hasAuthority("agreement:manage")
                .requestMatchers("/api/admin/business/orders/**","/api/admin/business/after-sales/**","/api/admin/business/agreement-orders/**",
                  "/api/admin/business/platform-orders/**","/api/admin/business/finance/**").hasAuthority("order:manage")
                .requestMatchers("/api/admin/**").denyAll()
                .anyRequest().authenticated())
            .httpBasic(Customizer.withDefaults())
            .addFilterBefore(new AdminLoginProtectionFilter(loginAttempts), BasicAuthenticationFilter.class)
            .addFilterAfter(new AdminAuditFilter(jdbc), BasicAuthenticationFilter.class)
            .build();
    }
}
