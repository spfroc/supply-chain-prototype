CREATE TABLE frequent_purchase_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  default_quantity INT NOT NULL DEFAULT 1,
  remark VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_frequent_purchase_user_sku (user_id,sku_id),
  KEY idx_frequent_purchase_user_sort (user_id,sort_order,id),
  CONSTRAINT fk_frequent_purchase_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_frequent_purchase_user FOREIGN KEY (user_id) REFERENCES enterprise_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_frequent_purchase_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
