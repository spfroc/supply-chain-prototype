package cn.govproc.supplychain.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Records authenticated admin mutations without coupling audit code to controllers. */
public class AdminAuditFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(AdminAuditFilter.class);
    private final JdbcClient jdbc;

    public AdminAuditFilter(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        return !request.getRequestURI().startsWith("/api/admin/")
            || "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)
            || "OPTIONS".equalsIgnoreCase(method);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank()) requestId = UUID.randomUUID().toString();
        response.setHeader("X-Request-Id", requestId);
        Throwable failure = null;
        try {
            chain.doFilter(request, response);
        } catch (IOException | ServletException | RuntimeException ex) {
            failure = ex;
            throw ex;
        } finally {
            writeLog(request, response, requestId, failure);
        }
    }

    private void writeLog(HttpServletRequest request, HttpServletResponse response, String requestId, Throwable failure) {
        try {
            Authentication principal = SecurityContextHolder.getContext().getAuthentication();
            if (principal == null || !principal.isAuthenticated() || "anonymousUser".equals(principal.getName())) return;
            String path = request.getRequestURI();
            String[] parts = path.substring("/api/admin/".length()).split("/");
            boolean success = failure == null && response.getStatus() < 400;
            jdbc.sql("""
                INSERT INTO operation_log(operator_type,operator_id,module,action,target_type,target_id,
                  ip,request_id,result)
                VALUES('ADMIN',(SELECT id FROM sys_admin_user WHERE username=:username LIMIT 1),
                  :module,:action,:targetType,:targetId,:ip,:requestId,:result)
                """).params(Map.ofEntries(
                    Map.entry("module", module(parts)),
                    Map.entry("action", action(request.getMethod(), parts)),
                    Map.entry("targetType", parts.length > 1 ? parts[1].toUpperCase().replace('-', '_') : "ADMIN"),
                    Map.entry("targetId", lastTarget(parts)), Map.entry("username", principal.getName()),
                    Map.entry("ip", clientIp(request)),
                    Map.entry("requestId", requestId), Map.entry("result", success ? "SUCCESS" : "FAILED")
                )).update();
        } catch (Exception ex) {
            // Audit persistence must never turn a successful business operation into a failure.
            log.warn("Failed to persist admin audit log for {} {}", request.getMethod(), request.getRequestURI(), ex);
        }
    }

    private static String module(String[] parts) {
        if (parts.length == 0) return "管理后台";
        return switch (parts[0]) {
            case "business" -> "业务管理";
            case "system" -> "系统管理";
            case "content" -> "内容管理";
            case "agreements" -> "协议管理";
            case "uploads" -> "文件管理";
            default -> "管理后台";
        };
    }

    private static String action(String method, String[] parts) {
        String resource = parts.length > 1 ? parts[1] : "数据";
        String verb = switch (method.toUpperCase()) {
            case "POST" -> "新增";
            case "PUT", "PATCH" -> "编辑";
            case "DELETE" -> "删除";
            default -> method.toUpperCase();
        };
        return verb + resource;
    }

    private static String lastTarget(String[] parts) {
        if (parts.length == 0) return "-";
        String value = parts[parts.length - 1];
        return value.matches("\\d+") ? value : "-";
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        String realIp = request.getHeader("X-Real-IP");
        return realIp == null || realIp.isBlank() ? request.getRemoteAddr() : realIp;
    }
}
