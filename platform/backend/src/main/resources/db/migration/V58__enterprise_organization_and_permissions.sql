ALTER TABLE enterprise_user
  ADD COLUMN department_id BIGINT UNSIGNED NULL AFTER enterprise_id,
  ADD KEY idx_enterprise_user_department (enterprise_id, department_id);

CREATE TABLE enterprise_department (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  parent_key BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(parent_id,0)) STORED,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_enterprise_department_name (enterprise_id, parent_key, name),
  KEY idx_enterprise_department_tree (enterprise_id, parent_id, status, sort_order),
  CONSTRAINT fk_enterprise_department_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_enterprise_department_parent FOREIGN KEY (parent_id) REFERENCES enterprise_department(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE enterprise_user
  ADD CONSTRAINT fk_enterprise_user_department FOREIGN KEY (department_id) REFERENCES enterprise_department(id);

CREATE TABLE enterprise_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  permission_code VARCHAR(80) NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_enterprise_permission_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE enterprise_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  role_code VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  data_scope VARCHAR(20) NOT NULL DEFAULT 'SELF' COMMENT 'SELF/DEPARTMENT/ENTERPRISE',
  read_only TINYINT NOT NULL DEFAULT 0,
  built_in TINYINT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_enterprise_role_code (enterprise_id, role_code),
  KEY idx_enterprise_role_status (enterprise_id, status),
  CONSTRAINT fk_enterprise_role_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE enterprise_role_permission (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_enterprise_role_permission_role FOREIGN KEY (role_id) REFERENCES enterprise_role(id) ON DELETE CASCADE,
  CONSTRAINT fk_enterprise_role_permission_permission FOREIGN KEY (permission_id) REFERENCES enterprise_permission(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE enterprise_user_role (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_enterprise_user_role_user FOREIGN KEY (user_id) REFERENCES enterprise_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_enterprise_user_role_role FOREIGN KEY (role_id) REFERENCES enterprise_role(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO enterprise_permission(permission_code,module,action,name,description,sort_order) VALUES
  ('purchase:view','采购','VIEW','查看采购数据','查看商品、购物车和订单',10),
  ('purchase:manage','采购','MANAGE','管理采购','创建订单、复购及维护常购清单',20),
  ('order:view','订单','VIEW','查看订单','按数据范围查看订单和履约信息',30),
  ('finance:view','财务','VIEW','查看财务','查看对账、应付和发票',40),
  ('finance:manage','财务','MANAGE','管理财务','确认对账、登记付款和申请发票',50),
  ('agreement:view','协议','VIEW','查看协议','查看协议范围、价格和文件',60),
  ('organization:view','组织','VIEW','查看组织','查看部门、成员和角色',70),
  ('organization:manage','组织','MANAGE','管理组织','维护部门、成员、角色和授权',80),
  ('audit:view','审计','VIEW','审计只读','查看和导出授权范围内的业务数据',90);

INSERT INTO enterprise_role(enterprise_id,role_code,name,data_scope,read_only,built_in,status)
SELECT id,'ENTERPRISE_ADMIN','企业管理员','ENTERPRISE',0,1,1 FROM enterprise WHERE deleted_at IS NULL
UNION ALL
SELECT id,'BUYER','采购员','SELF',0,1,1 FROM enterprise WHERE deleted_at IS NULL
UNION ALL
SELECT id,'FINANCE_READONLY','财务只读','ENTERPRISE',1,1,1 FROM enterprise WHERE deleted_at IS NULL
UNION ALL
SELECT id,'AUDITOR_READONLY','审计只读','ENTERPRISE',1,1,1 FROM enterprise WHERE deleted_at IS NULL;

INSERT INTO enterprise_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM enterprise_role r JOIN enterprise_permission p
WHERE r.role_code='ENTERPRISE_ADMIN';

INSERT INTO enterprise_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM enterprise_role r JOIN enterprise_permission p
WHERE r.role_code='BUYER' AND p.permission_code IN
  ('purchase:view','purchase:manage','order:view','agreement:view');

INSERT INTO enterprise_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM enterprise_role r JOIN enterprise_permission p
WHERE r.role_code='FINANCE_READONLY' AND p.permission_code IN
  ('order:view','finance:view','agreement:view');

INSERT INTO enterprise_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM enterprise_role r JOIN enterprise_permission p
WHERE r.role_code='AUDITOR_READONLY' AND p.permission_code IN
  ('order:view','finance:view','agreement:view','organization:view','audit:view');

INSERT INTO enterprise_user_role(user_id,role_id)
SELECT u.id,r.id
FROM enterprise_user u
JOIN enterprise_role r ON r.enterprise_id=u.enterprise_id AND r.role_code=u.role_code
WHERE u.deleted_at IS NULL AND r.deleted_at IS NULL;
