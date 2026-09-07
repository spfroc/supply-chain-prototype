ALTER TABLE sys_admin_user ADD COLUMN invite_code VARCHAR(16) NULL AFTER email;
CREATE UNIQUE INDEX uk_sys_admin_user_invite_code ON sys_admin_user(invite_code);

ALTER TABLE enterprise ADD COLUMN salesperson_user_id BIGINT UNSIGNED NULL AFTER status;
CREATE INDEX idx_enterprise_salesperson_user ON enterprise(salesperson_user_id);
ALTER TABLE enterprise ADD CONSTRAINT fk_enterprise_salesperson_user
  FOREIGN KEY (salesperson_user_id) REFERENCES sys_admin_user(id);

ALTER TABLE portal_resource ADD COLUMN scenario_name VARCHAR(100) NULL AFTER title;
ALTER TABLE portal_resource ADD COLUMN budget_amount DECIMAL(12,2) NULL AFTER scenario_name;
CREATE INDEX idx_portal_solution_scenario_budget
  ON portal_resource(resource_type,scenario_name,budget_amount);

INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public,updated_by)
SELECT 'contact.floatingEnabled','true','BOOLEAN','联系方式','是否显示 Web 端右侧悬浮联系方式',1,1
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key='contact.floatingEnabled');

INSERT INTO sys_permission(permission_code,name,module,description)
SELECT 'sales:enterprise:view','查看邀请企业','企业管理','业务员查看通过本人邀请码关联的企业'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code='sales:enterprise:view');

INSERT INTO sys_role(role_code,name,description,status)
SELECT 'SALES_REP','业务员','可登录后只读查看本人邀请的企业',1
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code='SALES_REP');

INSERT IGNORE INTO sys_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM sys_role r JOIN sys_permission p
  ON p.permission_code IN ('dashboard:view','sales:enterprise:view')
WHERE r.role_code='SALES_REP';
