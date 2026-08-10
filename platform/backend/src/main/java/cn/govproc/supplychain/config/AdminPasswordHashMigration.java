package cn.govproc.supplychain.config;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminPasswordHashMigration implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminPasswordHashMigration.class);
    private final JdbcClient jdbc;
    private final PasswordEncoder passwordEncoder;

    public AdminPasswordHashMigration(JdbcClient jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Map<String, Object>> legacy = jdbc.sql("""
            SELECT id,password_hash AS passwordHash
            FROM sys_admin_user
            WHERE password_hash LIKE '{noop}%'
            FOR UPDATE
            """).query().listOfRows();
        int migrated = 0;
        for (Map<String, Object> row : legacy) {
            long id = ((Number) row.get("id")).longValue();
            String oldHash = String.valueOf(row.get("passwordHash"));
            String rawPassword = oldHash.substring("{noop}".length());
            migrated += jdbc.sql("""
                UPDATE sys_admin_user SET password_hash=:newHash
                WHERE id=:id AND password_hash=:oldHash
                """).param("newHash", passwordEncoder.encode(rawPassword))
                .param("id", id).param("oldHash", oldHash).update();
        }
        if (migrated > 0) log.info("Migrated {} legacy admin password hashes", migrated);
    }
}
