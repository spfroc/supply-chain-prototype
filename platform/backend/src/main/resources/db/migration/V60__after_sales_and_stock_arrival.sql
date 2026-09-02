CREATE TABLE after_sale_request (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_no VARCHAR(40) NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  applicant_user_id BIGINT UNSIGNED NOT NULL,
  order_main_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  service_type VARCHAR(20) NOT NULL COMMENT 'RETURN/EXCHANGE/REPAIR/REFUND',
  reason VARCHAR(100) NOT NULL,
  description VARCHAR(1000) NULL,
  requested_quantity INT NOT NULL,
  requested_amount DECIMAL(14,2) NULL,
  contact_name VARCHAR(100) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  evidence_json JSON NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0待处理 1处理中 2待寄回 3待收货 4已完成 5已驳回 6已取消',
  handling_result VARCHAR(1000) NULL,
  return_logistics_company VARCHAR(100) NULL,
  return_logistics_no VARCHAR(100) NULL,
  processed_by BIGINT UNSIGNED NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_after_sale_service_no (service_no),
  KEY idx_after_sale_enterprise_status (enterprise_id,status,created_at),
  KEY idx_after_sale_user (applicant_user_id,created_at),
  KEY idx_after_sale_order_item (order_item_id,status),
  CONSTRAINT fk_after_sale_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_after_sale_user FOREIGN KEY (applicant_user_id) REFERENCES enterprise_user(id),
  CONSTRAINT fk_after_sale_order FOREIGN KEY (order_main_id) REFERENCES order_main(id),
  CONSTRAINT fk_after_sale_item FOREIGN KEY (order_item_id) REFERENCES order_item(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE after_sale_timeline (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  operator_type VARCHAR(20) NOT NULL,
  operator_id BIGINT UNSIGNED NULL,
  action VARCHAR(40) NOT NULL,
  content VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_after_sale_timeline (request_id,created_at),
  CONSTRAINT fk_after_sale_timeline_request FOREIGN KEY (request_id) REFERENCES after_sale_request(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stock_arrival_subscription (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1订阅中 2已通知 0已取消',
  notified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_stock_arrival_user_sku (user_id,sku_id),
  KEY idx_stock_arrival_sku_status (sku_id,status),
  CONSTRAINT fk_stock_arrival_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_stock_arrival_user FOREIGN KEY (user_id) REFERENCES enterprise_user(id),
  CONSTRAINT fk_stock_arrival_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO enterprise_permission(permission_code,module,action,name,description,sort_order) VALUES
  ('service:view','服务','VIEW','查看售后服务','查看售后申请、物流和到货提醒',100),
  ('service:manage','服务','MANAGE','管理售后服务','提交售后、确认收货和维护到货提醒',110);

INSERT INTO enterprise_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM enterprise_role r JOIN enterprise_permission p
WHERE r.role_code='ENTERPRISE_ADMIN' AND p.permission_code IN ('service:view','service:manage');

INSERT INTO enterprise_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM enterprise_role r JOIN enterprise_permission p
WHERE r.role_code='BUYER' AND p.permission_code IN ('service:view','service:manage');

INSERT INTO enterprise_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM enterprise_role r JOIN enterprise_permission p
WHERE r.role_code IN ('FINANCE_READONLY','AUDITOR_READONLY') AND p.permission_code='service:view';
