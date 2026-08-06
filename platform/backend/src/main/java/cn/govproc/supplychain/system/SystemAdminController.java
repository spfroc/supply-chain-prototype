package cn.govproc.supplychain.system;

import cn.govproc.supplychain.common.PageSupport;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.security.Principal;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/system")
public class SystemAdminController {
    private final JdbcClient jdbc;

    public SystemAdminController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/me")
    Map<String, Object> me(Principal principal) {
        return jdbc.sql("""
            SELECT u.id,u.username,u.real_name AS realName,
                   GROUP_CONCAT(DISTINCT r.name ORDER BY r.id SEPARATOR '、') AS roleNames,
                   GROUP_CONCAT(DISTINCT p.permission_code ORDER BY p.permission_code) AS permissionCodes
            FROM sys_admin_user u
            LEFT JOIN sys_admin_user_role ur ON ur.user_id=u.id
            LEFT JOIN sys_role r ON r.id=ur.role_id
            LEFT JOIN sys_role_permission rp ON rp.role_id=r.id
            LEFT JOIN sys_permission p ON p.id=rp.permission_id
            WHERE u.username=:username AND u.status=1 AND u.deleted_at IS NULL
            GROUP BY u.id
            """).param("username", principal.getName()).query().singleRow();
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
    Object users(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                 @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
            SELECT u.id, u.username, u.real_name AS realName, u.phone, u.email, u.status,
                   DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i:%s') AS lastLoginAt,
                   DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
                   GROUP_CONCAT(r.name ORDER BY r.id SEPARATOR '、') AS roleNames,
                   GROUP_CONCAT(r.id ORDER BY r.id) AS roleIds
            FROM sys_admin_user u
            LEFT JOIN sys_admin_user_role ur ON ur.user_id = u.id
            LEFT JOIN sys_role r ON r.id = ur.role_id
            WHERE u.deleted_at IS NULL
            GROUP BY u.id
            """;
        return pagedOrAll(base,"q.id",page,pageSize,keyword,status,List.of("username","realName","phone","email","roleNames"),"status");
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
    }

    @DeleteMapping("/users/{id}")
    @Transactional
    void deleteUser(@PathVariable long id) {
        if (id == 1) throw new IllegalArgumentException("超级管理员账号不能删除");
        requireChanged(jdbc.sql("UPDATE sys_admin_user SET deleted_at=NOW(), status=0 WHERE id=:id AND deleted_at IS NULL")
            .param("id", id).update(), "用户不存在");
    }

    @GetMapping("/roles")
    Object roles(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                 @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
            SELECT r.id, r.role_code AS roleCode, r.name, r.description, r.status,
                   COUNT(DISTINCT ur.user_id) AS userCount,
                   GROUP_CONCAT(rp.permission_id ORDER BY rp.permission_id) AS permissionIds
            FROM sys_role r
            LEFT JOIN sys_admin_user_role ur ON ur.role_id=r.id
            LEFT JOIN sys_role_permission rp ON rp.role_id=r.id
            GROUP BY r.id
            """;
        return pagedOrAll(base,"q.id",page,pageSize,keyword,status,List.of("roleCode","name","description"),"status");
    }

    @GetMapping("/permissions")
    Object permissions(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                       @RequestParam(defaultValue="") String keyword) {
        String base="""
            SELECT id, permission_code AS permissionCode, name, module, description
            FROM sys_permission
            """;
        return pagedOrAll(base,"q.module,q.id",page,pageSize,keyword,null,List.of("permissionCode","name","module","description"),null);
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
    }

    @DeleteMapping("/roles/{id}")
    @Transactional
    void deleteRole(@PathVariable long id) {
        if (id == 1) throw new IllegalArgumentException("超级管理员角色不能删除");
        long users = jdbc.sql("SELECT COUNT(*) FROM sys_admin_user_role WHERE role_id=:id")
            .param("id", id).query(Long.class).single();
        if (users > 0) throw new IllegalArgumentException("该角色仍有关联用户，不能删除");
        requireChanged(jdbc.sql("DELETE FROM sys_role WHERE id=:id").param("id", id).update(), "角色不存在");
    }

    @GetMapping("/logs")
    Object logs(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                @RequestParam(defaultValue="") String keyword) {
        String base="""
            SELECT id, operator_type AS operatorType, operator_id AS operatorId, module, action,
              target_type AS targetType, target_id AS targetId, ip, request_id AS requestId, result,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
            FROM operation_log
            """;
        return pagedOrAll(base,"q.id DESC",page,pageSize,keyword,null,List.of("operatorType","module","action","targetType","targetId","ip","requestId","result"),null);
    }

    @GetMapping("/configs")
    Object configs(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                   @RequestParam(defaultValue="") String keyword) {
        String base="""
            SELECT id, config_key AS configKey, config_value AS configValue, value_type AS valueType,
              group_name AS groupName, description, is_public AS isPublic,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
            FROM system_config
            """;
        return pagedOrAll(base,"q.groupName,q.id",page,pageSize,keyword,null,List.of("configKey","configValue","groupName","description"),null);
    }

    @PutMapping("/configs/{id}")
    @Transactional
    void updateConfig(@PathVariable long id, @Valid @RequestBody ConfigRequest request) {
        requireChanged(jdbc.sql("""
            UPDATE system_config SET config_value=:configValue, description=:description,
              is_public=:isPublic, updated_by=1 WHERE id=:id
            """).params(Map.of("id", id, "configValue", request.configValue(),
                "description", value(request.description()), "isPublic", request.isPublic())).update(), "配置不存在");
    }

    @GetMapping("/options")
    Object options(
        @RequestParam(defaultValue = "LOGISTICS_COMPANY") String type,
        @RequestParam(required = false) Boolean enabled,
        @RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
        @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status
    ) {
        String statusFilter = Boolean.TRUE.equals(enabled) ? " AND status=1" : "";
        String base="""
            SELECT id, option_type AS optionType, label, option_value AS optionValue,
              sort_order AS sortOrder, status,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
            FROM system_option
            WHERE option_type=:type AND deleted_at IS NULL
            """ + statusFilter;
        var params=Map.of("type",type);
        if(page==null) return jdbc.sql(base+" ORDER BY sortOrder,id").params(params).query().listOfRows();
        return PageSupport.query(jdbc,base,"q.sortOrder,q.id",params,page,pageSize,keyword,status,
          List.of("label","optionValue"),"status");
    }

    @GetMapping("/option-groups")
    Object optionGroups(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                        @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status) {
        String base="""
            SELECT g.id,g.option_code AS optionCode,g.option_name AS optionName,
              g.control_type AS controlType,g.sort_order AS sortOrder,g.status,
              COUNT(o.id) AS optionCount,
              DATE_FORMAT(g.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
            FROM system_option_group g
            LEFT JOIN system_option o ON o.option_type=g.option_code AND o.deleted_at IS NULL
            GROUP BY g.id
            """;
        return pagedOrAll(base,"q.sortOrder,q.id",page,pageSize,keyword,status,List.of("optionCode","optionName","controlType"),"status");
    }

    @PostMapping("/option-groups")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    Map<String, Object> createOptionGroup(@Valid @RequestBody OptionGroupRequest request) {
        String code = "OPTION_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
        jdbc.sql("""
            INSERT INTO system_option_group(option_code,option_name,control_type,sort_order,status)
            VALUES(:code,:name,:controlType,:sortOrder,:status)
            """).params(Map.of(
                "code", code, "name", request.optionName(),
                "controlType", request.controlType(), "sortOrder", request.sortOrder(),
                "status", request.status()
            )).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        return Map.of("id", id, "optionCode", code);
    }

    @PutMapping("/option-groups/{id}")
    @Transactional
    void updateOptionGroup(@PathVariable long id, @Valid @RequestBody OptionGroupRequest request) {
        requireChanged(jdbc.sql("""
            UPDATE system_option_group SET option_name=:name,control_type=:controlType,
              sort_order=:sortOrder,status=:status WHERE id=:id
            """).params(Map.of(
                "id", id, "name", request.optionName(),
                "controlType", request.controlType(), "sortOrder", request.sortOrder(),
                "status", request.status()
            )).update(), "选项组不存在");
    }

    @DeleteMapping("/option-groups/{id}")
    @Transactional
    void deleteOptionGroup(@PathVariable long id) {
        String code = jdbc.sql("SELECT option_code FROM system_option_group WHERE id=:id")
            .param("id", id).query(String.class).optional().orElseThrow(() -> new IllegalArgumentException("选项组不存在"));
        long count = jdbc.sql("SELECT COUNT(*) FROM system_option WHERE option_type=:code")
            .param("code", code).query(Long.class).single();
        if (count > 0) throw new IllegalArgumentException("请先删除该选项组中的全部选项");
        jdbc.sql("DELETE FROM system_option_group WHERE id=:id").param("id", id).update();
    }

    @PostMapping("/options")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    Map<String, Object> createOption(@Valid @RequestBody OptionRequest request) {
        jdbc.sql("""
            INSERT INTO system_option(option_type,label,option_value,sort_order,status)
            VALUES(:type,:label,:optionValue,:sortOrder,:status)
            """).params(Map.of(
                "type", request.optionType(), "label", request.label(),
                "optionValue", request.optionValue(), "sortOrder", request.sortOrder(),
                "status", request.status()
            )).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        return Map.of("id", id);
    }

    @PutMapping("/options/{id}")
    @Transactional
    void updateOption(@PathVariable long id, @Valid @RequestBody OptionRequest request) {
        requireChanged(jdbc.sql("""
            UPDATE system_option SET option_type=:type,label=:label,option_value=:optionValue,
              sort_order=:sortOrder,status=:status
            WHERE id=:id AND deleted_at IS NULL
            """).params(Map.of(
                "id", id, "type", request.optionType(), "label", request.label(),
                "optionValue", request.optionValue(), "sortOrder", request.sortOrder(),
                "status", request.status()
            )).update(), "选项不存在");
    }

    @DeleteMapping("/options/{id}")
    @Transactional
    void deleteOption(@PathVariable long id) {
        requireChanged(jdbc.sql("""
            DELETE FROM system_option WHERE id=:id
            """).param("id", id).update(), "选项不存在");
    }

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    private Object pagedOrAll(String base,String order,Integer page,int pageSize,String keyword,Integer status,
                              List<String> searchColumns,String statusColumn) {
        if(page==null) return jdbc.sql(base+" ORDER BY "+order.replace("q.","")).query().listOfRows();
        return PageSupport.query(jdbc,base,order,Map.of(),page,pageSize,keyword,status,searchColumns,statusColumn);
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

    public record OptionRequest(
        @NotBlank String optionType, @NotBlank String label, @NotBlank String optionValue,
        int sortOrder, int status
    ) {}

    public record OptionGroupRequest(
        @NotBlank String optionName, @NotBlank String controlType, int sortOrder, int status
    ) {}
}
