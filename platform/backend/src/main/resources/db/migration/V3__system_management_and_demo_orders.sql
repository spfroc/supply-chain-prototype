CREATE TABLE sys_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  permission_code VARCHAR(80) NOT NULL,
  name VARCHAR(80) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_permission_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sys_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_code VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_role_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sys_role_permission (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permission_role FOREIGN KEY (role_id) REFERENCES sys_role(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permission_permission FOREIGN KEY (permission_id) REFERENCES sys_permission(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sys_admin_user (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(50) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(120) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sys_admin_user_role (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_admin_user_role_user FOREIGN KEY (user_id) REFERENCES sys_admin_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_user_role_role FOREIGN KEY (role_id) REFERENCES sys_role(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE system_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'TEXT',
  group_name VARCHAR(50) NOT NULL DEFAULT '基础配置',
  description VARCHAR(255) NULL,
  is_public TINYINT NOT NULL DEFAULT 0,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_system_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_permission (id, permission_code, name, module, description) VALUES
  (1, 'dashboard:view', '查看经营概览', '工作台', '查看经营数据和待办事项'),
  (2, 'product:manage', '管理商品', '商品', '维护商品、分类和库存'),
  (3, 'enterprise:manage', '管理企业', '企业', '维护企业与企业成员'),
  (4, 'agreement:manage', '管理协议', '协议', '维护协议及协议商品'),
  (5, 'order:manage', '管理订单', '订单', '确认付款、发货和查看订单'),
  (6, 'system:user', '管理后台用户', '系统', '新增、编辑和停用后台用户'),
  (7, 'system:role', '管理角色权限', '系统', '配置角色及权限'),
  (8, 'system:config', '管理基础配置', '系统', '维护平台基础配置'),
  (9, 'system:log', '查看操作日志', '系统', '查询后台操作日志');

INSERT INTO sys_role (id, role_code, name, description, status) VALUES
  (1, 'SUPER_ADMIN', '超级管理员', '拥有平台全部管理权限', 1),
  (2, 'OPERATOR', '运营管理员', '负责商品、企业、协议和订单运营', 1),
  (3, 'FINANCE', '财务人员', '负责线下转账确认和订单财务查询', 1);

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT 1, id FROM sys_permission;
INSERT INTO sys_role_permission (role_id, permission_id) VALUES
  (2,1),(2,2),(2,3),(2,4),(2,5),(3,1),(3,5),(3,9);

INSERT INTO sys_admin_user (id, username, password_hash, real_name, phone, email, status, last_login_at) VALUES
  (1, 'admin', '{noop}change-me-before-production', '王运营', '13800000001', 'admin@example.local', 1, NOW()),
  (2, 'operator', '{noop}demo-password', '李运营', '13800000002', 'operator@example.local', 1, NULL),
  (3, 'finance', '{noop}demo-password', '赵财务', '13800000003', 'finance@example.local', 1, NULL);
INSERT INTO sys_admin_user_role (user_id, role_id) VALUES (1,1),(2,2),(3,3);

INSERT INTO system_config (config_key, config_value, value_type, group_name, description, is_public, updated_by) VALUES
  ('platform.name', '政企采购供应链', 'TEXT', '平台信息', 'Web 与 H5 展示的平台名称', 1, 1),
  ('platform.servicePhone', '400-800-2026', 'TEXT', '平台信息', '平台服务电话', 1, 1),
  ('order.paymentHours', '48', 'NUMBER', '订单配置', '银行转账付款时限（小时）', 0, 1),
  ('order.autoCancel', 'true', 'BOOLEAN', '订单配置', '超时未付款是否自动取消', 0, 1),
  ('stock.lowThreshold', '10', 'NUMBER', '库存配置', '低库存提醒阈值', 0, 1);

INSERT INTO address (id, enterprise_id, user_id, contact_name, contact_phone, province, city, district, detail, is_default) VALUES
  (1, 1, 1, '张经理', '13800002108', '山东省', '济南市', '历下区', '经十路10001号总部办公楼', 1),
  (2, 1, 1, '李主任', '13800003921', '山东省', '青岛市', '市南区', '香港中路88号项目部', 0);

INSERT INTO cart_item (user_id, sku_id, quantity, selected) VALUES
  (1, 1, 1, 1),
  (1, 2, 2, 1);

INSERT INTO order_main
  (id, order_no, enterprise_id, user_id, agreement_id, item_amount, freight_amount, payable_amount,
   payment_status, order_status, price_version, idempotency_key, payment_due_at)
VALUES
  (1, 'PO202607280001', 1, 1, 1, 6852.00, 0, 6852.00, 0, 0, 'seed-v1', 'seed-order-1', DATE_ADD(NOW(), INTERVAL 48 HOUR)),
  (2, 'PO202607260018', 1, 1, 1, 372.00, 0, 372.00, 2, 1, 'seed-v1', 'seed-order-2', NULL);

INSERT INTO order_sub (id, order_main_id, sub_order_no, address_snapshot, status) VALUES
  (1, 1, 'PO202607280001-01', JSON_OBJECT('contactName','张经理','phone','13800002108','address','山东省济南市历下区经十路10001号总部办公楼'), 0),
  (2, 2, 'PO202607260018-01', JSON_OBJECT('contactName','李主任','phone','13800003921','address','山东省青岛市市南区香港中路88号项目部'), 0);

INSERT INTO order_item (order_main_id, order_sub_id, sku_id, quantity, unit_price, total_price, snapshot_json) VALUES
  (1, 1, 1, 1, 6480.00, 6480.00, JSON_OBJECT('title','联想 ThinkBook 16+ 商务本','skuCode','SKU-TB16-U7-32-1T')),
  (1, 1, 2, 2, 186.00, 372.00, JSON_OBJECT('title','得力 A4 多功能复印纸','skuCode','SKU-DELI-A4-70G-8')),
  (2, 2, 2, 2, 186.00, 372.00, JSON_OBJECT('title','得力 A4 多功能复印纸','skuCode','SKU-DELI-A4-70G-8'));

INSERT INTO operation_log
  (operator_type, operator_id, module, action, target_type, target_id, before_json, after_json, ip, request_id, result)
VALUES
  ('ADMIN', 1, '系统管理', '更新配置', 'SYSTEM_CONFIG', 'platform.name', NULL,
   JSON_OBJECT('value','政企采购供应链'), '182.168.1.201', 'seed-log-1', 'SUCCESS'),
  ('ADMIN', 2, '协议管理', '调整协议价', 'AGREEMENT_ITEM', '1',
   JSON_OBJECT('price',6580), JSON_OBJECT('price',6480), '182.168.1.202', 'seed-log-2', 'SUCCESS');
