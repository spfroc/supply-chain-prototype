CREATE TABLE home_floor (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  subtitle VARCHAR(255) NULL,
  content_type VARCHAR(24) NOT NULL COMMENT 'PRODUCT/SOLUTION/CATEGORY/CONTENT',
  selection_rule VARCHAR(24) NOT NULL COMMENT 'MANUAL/LATEST/SALES/VIEWS/CATEGORY/BRAND/PLATFORM/AGREEMENT',
  reference_id BIGINT UNSIGNED NULL,
  display_count INT NOT NULL DEFAULT 4,
  target_scope VARCHAR(16) NOT NULL DEFAULT 'ALL' COMMENT 'ALL/WEB/H5',
  link_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_home_floor_status_sort (status, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE home_floor_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  floor_id BIGINT UNSIGNED NOT NULL,
  content_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_home_floor_content (floor_id, content_id),
  KEY idx_home_floor_item_sort (floor_id, sort_order, id),
  CONSTRAINT fk_home_floor_item_floor FOREIGN KEY (floor_id) REFERENCES home_floor(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO home_floor(title,subtitle,content_type,selection_rule,display_count,target_scope,link_url,sort_order,status) VALUES
  ('精选商品','精选企业采购商品','PRODUCT','LATEST',4,'ALL','/web/products',10,1),
  ('最新上架','及时发现新增采购商品','PRODUCT','LATEST',4,'ALL','/web/products',20,1),
  ('方案推荐','按场景选择完整设备组合','SOLUTION','LATEST',3,'ALL','/web/solutions',30,1);
