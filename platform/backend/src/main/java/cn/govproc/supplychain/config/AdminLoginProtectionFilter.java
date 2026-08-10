package cn.govproc.supplychain.config;

import cn.govproc.supplychain.auth.LoginAttemptService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class AdminLoginProtectionFilter extends OncePerRequestFilter {
    private final LoginAttemptService attempts;

    public AdminLoginProtectionFilter(LoginAttemptService attempts) {
        this.attempts = attempts;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/admin/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String identifier = basicIdentifier(request.getHeader("Authorization"));
        if (identifier != null && attempts.isBlocked("admin", identifier, request)) {
            response.setStatus(429);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/problem+json");
            response.getWriter().write("{\"title\":\"登录尝试过多\",\"status\":429,\"detail\":\"请15分钟后重试\"}");
            return;
        }
        chain.doFilter(request, response);
        if (identifier == null) return;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
            && !"anonymousUser".equals(authentication.getName())) {
            attempts.success("admin", identifier, request);
        } else if (response.getStatus() == HttpServletResponse.SC_UNAUTHORIZED) {
            attempts.failure("admin", identifier, request);
        }
    }

    private static String basicIdentifier(String authorization) {
        if (authorization == null || !authorization.regionMatches(true, 0, "Basic ", 0, 6)) return null;
        try {
            String decoded = new String(Base64.getDecoder().decode(authorization.substring(6).trim()),
                StandardCharsets.ISO_8859_1);
            int separator = decoded.indexOf(':');
            return separator > 0 ? decoded.substring(0, separator).trim() : null;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
