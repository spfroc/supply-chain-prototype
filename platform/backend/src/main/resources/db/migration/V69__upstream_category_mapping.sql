CREATE TABLE upstream_category_mapping (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(30) NOT NULL,
  external_category_id VARCHAR(80) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  external_parent_id VARCHAR(80) NULL,
  raw_json LONGTEXT NULL,
  last_synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_upstream_category (provider, external_category_id),
  KEY idx_upstream_category_local (category_id),
  CONSTRAINT fk_upstream_category_local FOREIGN KEY (category_id) REFERENCES category(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
