package cn.govproc.supplychain.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class LoginAttemptService {
    private static final Logger log = LoggerFactory.getLogger(LoginAttemptService.class);
    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private final StringRedisTemplate redis;

    public LoginAttemptService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public boolean isBlocked(String scope, String identifier, HttpServletRequest request) {
        try {
            String value = redis.opsForValue().get(key(scope, identifier, request));
            return value != null && Long.parseLong(value) >= MAX_FAILURES;
        } catch (RuntimeException exception) {
            log.warn("Login rate-limit lookup failed; allowing authentication attempt", exception);
            return false;
        }
    }

    public void failure(String scope, String identifier, HttpServletRequest request) {
        try {
            String key = key(scope, identifier, request);
            Long failures = redis.opsForValue().increment(key);
            if (failures != null && failures == 1) redis.expire(key, WINDOW);
        } catch (RuntimeException exception) {
            log.warn("Login rate-limit update failed", exception);
        }
    }

    public void success(String scope, String identifier, HttpServletRequest request) {
        try {
            redis.delete(key(scope, identifier, request));
        } catch (RuntimeException exception) {
            log.warn("Login rate-limit reset failed", exception);
        }
    }

    private String key(String scope, String identifier, HttpServletRequest request) {
        String normalized = identifier == null ? "" : identifier.trim().toLowerCase();
        return "login-attempt:" + scope + ":" + sha256(normalized + "|" + clientIp(request));
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        String realIp = request.getHeader("X-Real-IP");
        return realIp == null || realIp.isBlank() ? request.getRemoteAddr() : realIp;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
