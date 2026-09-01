package cn.govproc.supplychain.auth;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EnterpriseAuthorizationService {
    private final JdbcClient jdbc;
    private final ClientAuthService auth;

    public EnterpriseAuthorizationService(JdbcClient jdbc, ClientAuthService auth) {
        this.jdbc = jdbc;
        this.auth = auth;
    }

    public void require(String permissionCode) {
        var current = auth.current();
        if ("ENTERPRISE_ADMIN".equals(current.roleCode())) return;
        int count = jdbc.sql("""
            SELECT COUNT(*)
            FROM enterprise_user_role ur
            JOIN enterprise_role r ON r.id=ur.role_id AND r.status=1 AND r.deleted_at IS NULL
            JOIN enterprise_role_permission rp ON rp.role_id=r.id
            JOIN enterprise_permission p ON p.id=rp.permission_id
            WHERE ur.user_id=:userId AND r.enterprise_id=:enterpriseId
              AND p.permission_code=:permissionCode
            """).params(Map.of("userId", current.userId(), "enterpriseId", current.enterpriseId(),
                "permissionCode", permissionCode)).query(Integer.class).single();
        if (count == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前账号没有此操作权限");
    }
}
