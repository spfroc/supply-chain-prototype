CREATE TABLE upstream_product_mapping (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(30) NOT NULL,
  external_sku VARCHAR(80) NOT NULL,
  library INT NOT NULL DEFAULT 0,
  product_id BIGINT UNSIGNED NULL,
  raw_json LONGTEXT NULL,
  last_synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_upstream_product (provider, external_sku, library),
  KEY idx_upstream_product_id (product_id),
  CONSTRAINT fk_upstream_product_mapping_product FOREIGN KEY (product_id) REFERENCES product_spu(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE upstream_product_sync_job (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  total_count INT NOT NULL DEFAULT 0,
  total_pages INT NOT NULL DEFAULT 0,
  current_page INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  error_message VARCHAR(1000) NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_upstream_sync_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE upstream_message (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(30) NOT NULL,
  remote_message_id BIGINT NOT NULL,
  message_type INT NOT NULL,
  message_content LONGTEXT NOT NULL,
  process_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  process_result VARCHAR(1000) NULL,
  remote_deleted TINYINT NOT NULL DEFAULT 0,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  deleted_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_upstream_message (provider, remote_message_id),
  KEY idx_upstream_message_status (process_status, remote_deleted, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
