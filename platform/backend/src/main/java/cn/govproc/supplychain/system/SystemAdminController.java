package cn.govproc.supplychain.system;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/system")
public class SystemAdminController {
    private final JdbcClient jdbc;

    public SystemAdminController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/summary")
    Map<String, Object> summary() {
        return Map.of(
            "users", count("SELECT COUNT(*) FROM sys_admin_user WHERE deleted_at IS NULL"),
            "roles", count("SELECT COUNT(*) FROM sys_role"),
            "permissions", count("SELECT COUNT(*) FROM sys_permission"),
            "todayLogs", count("SELECT COUNT(*) FROM operation_log WHERE created_at >= CURRENT_DATE")
        );
    }

    @GetMapping("/users")
    List<Map<String, Object>> users() {
        return jdbc.sql("""
            SELECT u.id, u.username, u.real_name AS realName, u.phone, u.email, u.status,
                   DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i:%s') AS lastLoginAt,
                   DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
                   GROUP_CONCAT(r.name ORDER BY r.id SEPARATOR '、') AS roleNames,
                   GROUP_CONCAT(r.id ORDER BY r.id) AS roleIds
            FROM sys_admin_user u
            LEFT JOIN sys_admin_user_role ur ON ur.user_id = u.id
            LEFT JOIN sys_role r ON r.id = ur.role_id
            WHERE u.deleted_at IS NULL
            GROUP BY u.id ORDER BY u.id
            """).query().listOfRows();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    Map<String, Object> createUser(@Valid @RequestBody UserRequest request) {
        jdbc.sql("""
            INSERT INTO sys_admin_user (username, password_hash, real_name, phone, email, status)
            VALUES (:username, :password, :realName, :phone, :email, :status)
            """).params(Map.of(
                "username", request.username(), "password", "{noop}" + request.password(),
                "realName", request.realName(), "phone", value(request.phone()),
                "email", value(request.email()), "status", request.status()
            )).update();
        long id = jdbc.sql("SELECT id FROM sys_admin_user WHERE username=:username")
            .param("username", request.username()).query(Long.class).single();
        replaceUserRoles(id, request.roleIds());
        log("系统管理", "新增用户", "SYS_ADMIN_USER", String.valueOf(id));
        return Map.of("id", id);
    }

    @PutMapping("/users/{id}")
    @Transactional
    void updateUser(@PathVariable long id, @Valid @RequestBody UserRequest request) {
        int changed = jdbc.sql("""
            UPDATE sys_admin_user SET username=:username, real_name=:realName, phone=:phone,
              email=:email, status=:status,
              password_hash=IF(:password='', password_hash, CONCAT('{noop}', :password))
            WHERE id=:id AND deleted_at IS NULL
            """).params(Map.of(
                "id", id, "username", request.username(), "password", value(request.password()),
                "realName", request.realName(), "phone", value(request.phone()),
                "email", value(request.email()), "status", request.status()
            )).update();
        requireChanged(changed, "用户不存在");
        replaceUserRoles(id, request.roleIds());
        log("系统管理", "编辑用户", "SYS_ADMIN_USER", String.valueOf(id));
    }

    @DeleteMapping("/users/{id}")
    @Transactional
    void deleteUser(@PathVariable long id) {
        if (id == 1) throw new IllegalArgumentException("超级管理员账号不能删除");
        requireChanged(jdbc.sql("UPDATE sys_admin_user SET deleted_at=NOW(), status=0 WHERE id=:id AND deleted_at IS NULL")
            .param("id", id).update(), "用户不存在");
        log("系统管理", "删除用户", "SYS_ADMIN_USER", String.valueOf(id));
    }

    @GetMapping("/roles")
    List<Map<String, Object>> roles() {
        return jdbc.sql("""
            SELECT r.id, r.role_code AS roleCode, r.name, r.description, r.status,
                   COUNT(DISTINCT ur.user_id) AS userCount,
                   GROUP_CONCAT(rp.permission_id ORDER BY rp.permission_id) AS permissionIds
            FROM sys_role r
            LEFT JOIN sys_admin_user_role ur ON ur.role_id=r.id
            LEFT JOIN sys_role_permission rp ON rp.role_id=r.id
            GROUP BY r.id ORDER BY r.id
            """).query().listOfRows();
    }

    @GetMapping("/permissions")
    List<Map<String, Object>> permissions() {
        return jdbc.sql("""
            SELECT id, permission_code AS permissionCode, name, module, description
            FROM sys_permission ORDER BY module, id
            """).query().listOfRows();
    }

    @PostMapping("/roles")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    Map<String, Object> createRole(@Valid @RequestBody RoleRequest request) {
        jdbc.sql("""
            INSERT INTO sys_role (role_code, name, description, status)
            VALUES (:roleCode,:name,:description,:status)
            """).params(Map.of("roleCode", request.roleCode(), "name", request.name(),
                "description", value(request.description()), "status", request.status())).update();
        long id = jdbc.sql("SELECT id FROM sys_role WHERE role_code=:code")
            .param("code", request.roleCode()).query(Long.class).single();
        replaceRolePermissions(id, request.permissionIds());
        log("系统管理", "新增角色", "SYS_ROLE", String.valueOf(id));
        return Map.of("id", id);
    }

    @PutMapping("/roles/{id}")
    @Transactional
    void updateRole(@PathVariable long id, @Valid @RequestBody RoleRequest request) {
        requireChanged(jdbc.sql("""
            UPDATE sys_role SET role_code=:roleCode,name=:name,description=:description,status=:status WHERE id=:id
            """).params(Map.of("id", id, "roleCode", request.roleCode(), "name", request.name(),
                "description", value(request.description()), "status", request.status())).update(), "角色不存在");
        replaceRolePermissions(id, request.permissionIds());
        log("系统管理", "编辑角色", "SYS_ROLE", String.valueOf(id));
    }

    @DeleteMapping("/roles/{id}")
    @Transactional
    void deleteRole(@PathVariable long id) {
        if (id == 1) throw new IllegalArgumentException("超级管理员角色不能删除");
        long users = jdbc.sql("SELECT COUNT(*) FROM sys_admin_user_role WHERE role_id=:id")
            .param("id", id).query(Long.class).single();
        if (users > 0) throw new IllegalArgumentException("该角色仍有关联用户，不能删除");
        requireChanged(jdbc.sql("DELETE FROM sys_role WHERE id=:id").param("id", id).update(), "角色不存在");
        log("系统管理", "删除角色", "SYS_ROLE", String.valueOf(id));
    }

    @GetMapping("/logs")
    List<Map<String, Object>> logs() {
        return jdbc.sql("""
            SELECT id, operator_type AS operatorType, operator_id AS operatorId, module, action,
              target_type AS targetType, target_id AS targetId, ip, request_id AS requestId, result,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
            FROM operation_log ORDER BY id DESC LIMIT 200
            """).query().listOfRows();
    }

    @GetMapping("/configs")
    List<Map<String, Object>> configs() {
        return jdbc.sql("""
            SELECT id, config_key AS configKey, config_value AS configValue, value_type AS valueType,
              group_name AS groupName, description, is_public AS isPublic,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
            FROM system_config ORDER BY group_name, id
            """).query().listOfRows();
    }

    @PutMapping("/configs/{id}")
    @Transactional
    void updateConfig(@PathVariable long id, @Valid @RequestBody ConfigRequest request) {
        requireChanged(jdbc.sql("""
            UPDATE system_config SET config_value=:configValue, description=:description,
              is_public=:isPublic, updated_by=1 WHERE id=:id
            """).params(Map.of("id", id, "configValue", request.configValue(),
                "description", value(request.description()), "isPublic", request.isPublic())).update(), "配置不存在");
        log("系统管理", "更新配置", "SYSTEM_CONFIG", String.valueOf(id));
    }

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    private void replaceUserRoles(long userId, List<Long> roleIds) {
        jdbc.sql("DELETE FROM sys_admin_user_role WHERE user_id=:id").param("id", userId).update();
        roleIds.forEach(roleId -> jdbc.sql("INSERT INTO sys_admin_user_role(user_id,role_id) VALUES(:u,:r)")
            .params(Map.of("u", userId, "r", roleId)).update());
    }

    private void replaceRolePermissions(long roleId, List<Long> permissionIds) {
        jdbc.sql("DELETE FROM sys_role_permission WHERE role_id=:id").param("id", roleId).update();
        permissionIds.forEach(permissionId -> jdbc.sql("INSERT INTO sys_role_permission(role_id,permission_id) VALUES(:r,:p)")
            .params(Map.of("r", roleId, "p", permissionId)).update());
    }

    private void log(String module, String action, String targetType, String targetId) {
        jdbc.sql("""
            INSERT INTO operation_log(operator_type,operator_id,module,action,target_type,target_id,ip,request_id,result)
            VALUES('ADMIN',1,:module,:action,:targetType,:targetId,'127.0.0.1',:requestId,'SUCCESS')
            """).params(Map.of("module", module, "action", action, "targetType", targetType,
                "targetId", targetId, "requestId", UUID.randomUUID().toString())).update();
    }

    private static String value(String value) {
        return value == null ? "" : value;
    }

    private static void requireChanged(int changed, String message) {
        if (changed == 0) throw new IllegalArgumentException(message);
    }

    public record UserRequest(
        @NotBlank String username, String password, @NotBlank String realName,
        String phone, String email, int status, @NotEmpty List<Long> roleIds
    ) {}

    public record RoleRequest(
        @NotBlank String roleCode, @NotBlank String name, String description,
        int status, @NotEmpty List<Long> permissionIds
    ) {}

    public record ConfigRequest(@NotBlank String configValue, String description, int isPublic) {}
}
