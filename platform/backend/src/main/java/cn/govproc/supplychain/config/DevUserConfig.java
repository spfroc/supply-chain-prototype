package cn.govproc.supplychain.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

@Configuration
public class DevUserConfig {
    @Bean
    UserDetailsService users() {
        return new InMemoryUserDetailsManager(
            User.withUsername("admin").password("{noop}change-me-before-production").roles("ADMIN").build()
        );
    }
}
