CREATE TABLE solution_scene (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY(id), UNIQUE KEY uk_solution_scene_name(name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO solution_scene(name,description,sort_order,status)
SELECT scenario_name,MAX(subtitle),MIN(sort_order),1 FROM portal_resource
WHERE resource_type='SOLUTION' AND scenario_name IS NOT NULL AND scenario_name<>'' AND deleted_at IS NULL
GROUP BY scenario_name;

ALTER TABLE portal_resource ADD COLUMN scene_id BIGINT UNSIGNED NULL AFTER title;
UPDATE portal_resource p JOIN solution_scene s ON s.name=p.scenario_name
SET p.scene_id=s.id WHERE p.resource_type='SOLUTION';
CREATE INDEX idx_portal_resource_scene ON portal_resource(scene_id);
ALTER TABLE portal_resource ADD CONSTRAINT fk_portal_resource_scene FOREIGN KEY(scene_id) REFERENCES solution_scene(id);

INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public,updated_by)
SELECT 'footer.contactEnabled','true','BOOLEAN','门户页脚','是否显示页脚联系方式栏',1,1
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key='footer.contactEnabled');

INSERT IGNORE INTO sys_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM sys_role r JOIN sys_permission p ON p.permission_code='sales:enterprise:view'
WHERE r.role_code='SUPER_ADMIN';
