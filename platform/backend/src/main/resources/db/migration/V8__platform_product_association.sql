CREATE TABLE product_platform (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  platform_price DECIMAL(12,2) NOT NULL,
  product_url VARCHAR(500) NOT NULL,
  listing_status TINYINT NOT NULL DEFAULT 1,
  click_count BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_platform (platform_id, sku_id),
  KEY idx_product_platform_sku (sku_id),
  CONSTRAINT fk_product_platform_platform FOREIGN KEY (platform_id) REFERENCES portal_resource(id),
  CONSTRAINT fk_product_platform_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id),
  CONSTRAINT chk_product_platform_price CHECK (platform_price >= 0),
  CONSTRAINT chk_product_platform_click CHECK (click_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
