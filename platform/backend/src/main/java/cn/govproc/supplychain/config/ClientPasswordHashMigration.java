package cn.govproc.supplychain.config;

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
public class ClientPasswordHashMigration implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ClientPasswordHashMigration.class);
    private final JdbcClient jdbc;
    private final PasswordEncoder passwordEncoder;

    public ClientPasswordHashMigration(JdbcClient jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        var legacyUsers = jdbc.sql("""
            SELECT id,password_hash AS passwordHash
            FROM enterprise_user
            WHERE password_hash LIKE '{noop}%'
            FOR UPDATE
            """).query().listOfRows();
        int migrated = 0;
        for (Map<String, Object> user : legacyUsers) {
            long id = ((Number) user.get("id")).longValue();
            String oldHash = String.valueOf(user.get("passwordHash"));
            String rawPassword = oldHash.substring("{noop}".length());
            migrated += jdbc.sql("""
                UPDATE enterprise_user SET password_hash=:newHash
                WHERE id=:id AND password_hash=:oldHash
                """).params(Map.of("id", id, "oldHash", oldHash,
                    "newHash", passwordEncoder.encode(rawPassword))).update();
        }
        if (migrated > 0) log.info("Migrated {} client password hashes", migrated);
    }
}
