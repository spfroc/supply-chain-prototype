CREATE TABLE purchase_import_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PARSED',
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  invalid_rows INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_purchase_import_user (user_id, created_at),
  CONSTRAINT fk_purchase_import_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_purchase_import_user FOREIGN KEY (user_id) REFERENCES enterprise_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE purchase_import_item (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT NOT NULL,
  source_row INT NOT NULL,
  sku_code VARCHAR(100),
  quantity INT,
  sku_id BIGINT UNSIGNED,
  status VARCHAR(20) NOT NULL,
  error_message VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_purchase_import_row (task_id, source_row),
  INDEX idx_purchase_import_item_status (task_id, status),
  CONSTRAINT fk_purchase_import_item_task FOREIGN KEY (task_id) REFERENCES purchase_import_task(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_import_item_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
