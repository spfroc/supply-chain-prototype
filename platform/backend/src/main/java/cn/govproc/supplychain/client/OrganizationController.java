package cn.govproc.supplychain.client;

import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.auth.EnterpriseAuthorizationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.Map;
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
@RequestMapping("/api/client/organization")
public class OrganizationController {
    private final JdbcClient jdbc;
    private final ClientAuthService auth;
    private final EnterpriseAuthorizationService authorization;

    public OrganizationController(JdbcClient jdbc, ClientAuthService auth,
                                  EnterpriseAuthorizationService authorization) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.authorization = authorization;
    }

    @GetMapping("/me")
    Map<String, Object> currentAuthorization() {
        var current = auth.current();
        List<Map<String, Object>> roles = jdbc.sql("""
            SELECT r.id,r.role_code AS roleCode,r.name,r.data_scope AS dataScope,r.read_only AS readOnly
            FROM enterprise_user_role ur JOIN enterprise_role r ON r.id=ur.role_id
            WHERE ur.user_id=:userId AND r.enterprise_id=:enterpriseId AND r.status=1 AND r.deleted_at IS NULL
            ORDER BY r.built_in DESC,r.id
            """).params(Map.of("userId", current.userId(), "enterpriseId", current.enterpriseId()))
            .query().listOfRows();
        List<String> permissions = jdbc.sql("""
            SELECT DISTINCT p.permission_code
            FROM enterprise_user_role ur
            JOIN enterprise_role r ON r.id=ur.role_id AND r.status=1 AND r.deleted_at IS NULL
            JOIN enterprise_role_permission rp ON rp.role_id=r.id
            JOIN enterprise_permission p ON p.id=rp.permission_id
            WHERE ur.user_id=:userId AND r.enterprise_id=:enterpriseId
            ORDER BY p.permission_code
            """).params(Map.of("userId", current.userId(), "enterpriseId", current.enterpriseId()))
            .query(String.class).list();
        return Map.of("roles", roles, "permissionCodes", permissions,
            "legacyRoleCode", current.roleCode());
    }

    @GetMapping("/departments")
    List<Map<String, Object>> departments() {
        authorization.require("organization:view");
        return jdbc.sql("""
            SELECT d.id,d.parent_id AS parentId,d.name,d.sort_order AS sortOrder,d.status,
              (SELECT COUNT(*) FROM enterprise_user u WHERE u.department_id=d.id AND u.deleted_at IS NULL) AS memberCount
            FROM enterprise_department d
            WHERE d.enterprise_id=:enterpriseId AND d.deleted_at IS NULL
            ORDER BY d.parent_id IS NOT NULL,d.parent_id,d.sort_order,d.id
            """).param("enterpriseId", enterpriseId()).query().listOfRows();
    }

    @PostMapping("/departments")
    @ResponseStatus(HttpStatus.CREATED)
    void createDepartment(@Valid @RequestBody DepartmentRequest request) {
        authorization.require("organization:manage");
        validateParent(request.parentId(), null);
        jdbc.sql("""
            INSERT INTO enterprise_department(enterprise_id,parent_id,name,sort_order,status)
            VALUES(:enterpriseId,:parentId,:name,:sortOrder,:status)
            """).param("enterpriseId", enterpriseId()).param("parentId", request.parentId())
            .param("name", request.name().trim()).param("sortOrder", request.sortOrder())
            .param("status", request.status()).update();
    }

    @PutMapping("/departments/{id}")
    void updateDepartment(@PathVariable long id, @Valid @RequestBody DepartmentRequest request) {
        authorization.require("organization:manage");
        validateParent(request.parentId(), id);
        int changed = jdbc.sql("""
            UPDATE enterprise_department SET parent_id=:parentId,name=:name,sort_order=:sortOrder,status=:status
            WHERE id=:id AND enterprise_id=:enterpriseId AND deleted_at IS NULL
            """).param("parentId", request.parentId()).param("name", request.name().trim())
            .param("sortOrder", request.sortOrder()).param("status", request.status()).param("id", id)
            .param("enterpriseId", enterpriseId()).update();
        requireChanged(changed, "部门不存在");
    }

    @DeleteMapping("/departments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteDepartment(@PathVariable long id) {
        authorization.require("organization:manage");
        int children = jdbc.sql("""
            SELECT COUNT(*) FROM enterprise_department
            WHERE enterprise_id=:enterpriseId AND parent_id=:id AND deleted_at IS NULL
            """).params(Map.of("enterpriseId", enterpriseId(), "id", id)).query(Integer.class).single();
        if (children > 0) throw new IllegalArgumentException("请先处理下级部门");
        int members = jdbc.sql("""
            SELECT COUNT(*) FROM enterprise_user
            WHERE enterprise_id=:enterpriseId AND department_id=:id AND deleted_at IS NULL
            """).params(Map.of("enterpriseId", enterpriseId(), "id", id)).query(Integer.class).single();
        if (members > 0) throw new IllegalArgumentException("请先将部门成员转移到其他部门");
        int changed = jdbc.sql("""
            UPDATE enterprise_department SET deleted_at=NOW(),status=0
            WHERE id=:id AND enterprise_id=:enterpriseId AND deleted_at IS NULL
            """).params(Map.of("enterpriseId", enterpriseId(), "id", id)).update();
        requireChanged(changed, "部门不存在");
    }

    @GetMapping("/permissions")
    List<Map<String, Object>> permissions() {
        authorization.require("organization:view");
        return jdbc.sql("""
            SELECT id,permission_code AS permissionCode,module,action,name,description
            FROM enterprise_permission ORDER BY sort_order,id
            """).query().listOfRows();
    }

    @GetMapping("/roles")
    List<Map<String, Object>> roles() {
        authorization.require("organization:view");
        return jdbc.sql("""
            SELECT r.id,r.role_code AS roleCode,r.name,r.data_scope AS dataScope,r.read_only AS readOnly,
              r.built_in AS builtIn,r.status,COUNT(DISTINCT ur.user_id) AS memberCount,
              GROUP_CONCAT(DISTINCT p.permission_code ORDER BY p.sort_order) AS permissionCodes
            FROM enterprise_role r
            LEFT JOIN enterprise_user_role ur ON ur.role_id=r.id
            LEFT JOIN enterprise_role_permission rp ON rp.role_id=r.id
            LEFT JOIN enterprise_permission p ON p.id=rp.permission_id
            WHERE r.enterprise_id=:enterpriseId AND r.deleted_at IS NULL
            GROUP BY r.id ORDER BY r.built_in DESC,r.id
            """).param("enterpriseId", enterpriseId()).query().listOfRows();
    }

    @PostMapping("/roles")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    void createRole(@Valid @RequestBody RoleRequest request) {
        authorization.require("organization:manage");
        jdbc.sql("""
            INSERT INTO enterprise_role(enterprise_id,role_code,name,data_scope,read_only,built_in,status)
            VALUES(:enterpriseId,:roleCode,:name,:dataScope,:readOnly,0,:status)
            """).param("enterpriseId", enterpriseId()).param("roleCode", request.roleCode())
            .param("name", request.name().trim()).param("dataScope", request.dataScope())
            .param("readOnly", request.readOnly()).param("status", request.status()).update();
        long roleId = jdbc.sql("""
            SELECT id FROM enterprise_role WHERE enterprise_id=:enterpriseId AND role_code=:roleCode
            """).params(Map.of("enterpriseId", enterpriseId(), "roleCode", request.roleCode()))
            .query(Long.class).single();
        replaceRolePermissions(roleId, request.permissionCodes());
    }

    @PutMapping("/roles/{id}")
    @Transactional
    void updateRole(@PathVariable long id, @Valid @RequestBody RoleRequest request) {
        authorization.require("organization:manage");
        int changed = jdbc.sql("""
            UPDATE enterprise_role SET name=:name,data_scope=:dataScope,read_only=:readOnly,status=:status
            WHERE id=:id AND enterprise_id=:enterpriseId AND deleted_at IS NULL
            """).param("name", request.name().trim()).param("dataScope", request.dataScope())
            .param("readOnly", request.readOnly()).param("status", request.status()).param("id", id)
            .param("enterpriseId", enterpriseId()).update();
        requireChanged(changed, "角色不存在");
        replaceRolePermissions(id, request.permissionCodes());
    }

    @DeleteMapping("/roles/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteRole(@PathVariable long id) {
        authorization.require("organization:manage");
        List<Map<String, Object>> roles = jdbc.sql("""
            SELECT built_in AS builtIn,(SELECT COUNT(*) FROM enterprise_user_role WHERE role_id=r.id) AS memberCount
            FROM enterprise_role r WHERE r.id=:id AND r.enterprise_id=:enterpriseId AND r.deleted_at IS NULL
            """).params(Map.of("id", id, "enterpriseId", enterpriseId())).query().listOfRows();
        if (roles.isEmpty()) throw new IllegalArgumentException("角色不存在");
        Map<String, Object> role = roles.getFirst();
        if (((Number) role.get("builtIn")).intValue() == 1) throw new IllegalArgumentException("系统内置角色不能删除");
        if (((Number) role.get("memberCount")).intValue() > 0) throw new IllegalArgumentException("请先移除使用该角色的成员");
        jdbc.sql("UPDATE enterprise_role SET deleted_at=NOW(),status=0 WHERE id=:id")
            .param("id", id).update();
    }

    @PutMapping("/members/{memberId}/roles")
    @Transactional
    void assignMemberRoles(@PathVariable long memberId, @Valid @RequestBody MemberRolesRequest request) {
        authorization.require("organization:manage");
        int memberCount = jdbc.sql("""
            SELECT COUNT(*) FROM enterprise_user
            WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
            """).params(Map.of("memberId", memberId, "enterpriseId", enterpriseId())).query(Integer.class).single();
        requireChanged(memberCount, "企业成员不存在");
        int roleCount = jdbc.sql("""
            SELECT COUNT(*) FROM enterprise_role
            WHERE enterprise_id=:enterpriseId AND id IN (:roleIds) AND status=1 AND deleted_at IS NULL
            """).param("enterpriseId", enterpriseId()).param("roleIds", request.roleIds())
            .query(Integer.class).single();
        if (roleCount != request.roleIds().size()) throw new IllegalArgumentException("包含无效或已停用的角色");
        jdbc.sql("DELETE FROM enterprise_user_role WHERE user_id=:memberId").param("memberId", memberId).update();
        for (Long roleId : request.roleIds()) {
            jdbc.sql("INSERT INTO enterprise_user_role(user_id,role_id) VALUES(:memberId,:roleId)")
                .params(Map.of("memberId", memberId, "roleId", roleId)).update();
        }
        String legacyRole = jdbc.sql("""
            SELECT role_code FROM enterprise_role WHERE id IN (:roleIds)
            ORDER BY role_code='ENTERPRISE_ADMIN' DESC,role_code='BUYER' DESC,id LIMIT 1
            """).param("roleIds", request.roleIds()).query(String.class).single();
        jdbc.sql("UPDATE enterprise_user SET role_code=:roleCode WHERE id=:memberId")
            .params(Map.of("roleCode", legacyRole, "memberId", memberId)).update();
    }

    private void replaceRolePermissions(long roleId, List<String> permissionCodes) {
        int belongs = jdbc.sql("""
            SELECT COUNT(*) FROM enterprise_role WHERE id=:id AND enterprise_id=:enterpriseId AND deleted_at IS NULL
            """).params(Map.of("id", roleId, "enterpriseId", enterpriseId())).query(Integer.class).single();
        requireChanged(belongs, "角色不存在");
        jdbc.sql("DELETE FROM enterprise_role_permission WHERE role_id=:roleId").param("roleId", roleId).update();
        if (permissionCodes.isEmpty()) return;
        int inserted = jdbc.sql("""
            INSERT INTO enterprise_role_permission(role_id,permission_id)
            SELECT :roleId,id FROM enterprise_permission WHERE permission_code IN (:codes)
            """).param("roleId", roleId).param("codes", permissionCodes).update();
        if (inserted != permissionCodes.size()) throw new IllegalArgumentException("包含无效的权限编码");
    }

    private void validateParent(Long parentId, Long currentId) {
        if (parentId == null) return;
        if (parentId.equals(currentId)) throw new IllegalArgumentException("上级部门不能选择当前部门");
        int count = jdbc.sql("""
            SELECT COUNT(*) FROM enterprise_department
            WHERE id=:parentId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
            """).params(Map.of("parentId", parentId, "enterpriseId", enterpriseId())).query(Integer.class).single();
        requireChanged(count, "上级部门不存在");
    }

    private long enterpriseId() { return auth.current().enterpriseId(); }

    private static void requireChanged(int changed, String message) {
        if (changed == 0) throw new IllegalArgumentException(message);
    }

    public record DepartmentRequest(Long parentId, @NotBlank String name, int sortOrder, int status) {}

    public record RoleRequest(
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{2,39}") String roleCode,
        @NotBlank String name,
        @NotBlank @Pattern(regexp = "SELF|DEPARTMENT|ENTERPRISE") String dataScope,
        int readOnly,
        int status,
        @NotNull List<@NotBlank String> permissionCodes) {}

    public record MemberRolesRequest(@NotEmpty List<@NotNull Long> roleIds) {}
}
