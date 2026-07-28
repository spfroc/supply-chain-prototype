CREATE TABLE category (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  level TINYINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  icon VARCHAR(500) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES category(id),
  UNIQUE KEY uk_category_name_parent (name, parent_id),
  KEY idx_category_level_status (level, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE brand (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  logo VARCHAR(500) NULL,
  description VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_brand_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_spu (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  spu_code VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  brand_id BIGINT UNSIGNED NULL,
  main_image VARCHAR(500) NULL,
  gallery_json JSON NULL,
  attributes_json JSON NULL,
  summary VARCHAR(1000) NULL,
  detail_html LONGTEXT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0草稿 1在售 2下架',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_spu_code (spu_code),
  KEY idx_spu_category_status (category_id, status),
  CONSTRAINT fk_spu_category FOREIGN KEY (category_id) REFERENCES category(id),
  CONSTRAINT fk_spu_brand FOREIGN KEY (brand_id) REFERENCES brand(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_sku (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  spu_id BIGINT UNSIGNED NOT NULL,
  sku_code VARCHAR(40) NOT NULL,
  spec_json JSON NOT NULL,
  market_price DECIMAL(12,2) NOT NULL,
  member_price DECIMAL(12,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  reserved_stock INT NOT NULL DEFAULT 0,
  min_order_quantity INT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  version INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sku_code (sku_code),
  KEY idx_sku_spu_status (spu_id, status),
  CONSTRAINT fk_sku_spu FOREIGN KEY (spu_id) REFERENCES product_spu(id),
  CONSTRAINT chk_sku_stock CHECK (stock >= 0 AND reserved_stock >= 0 AND reserved_stock <= stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE enterprise (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  credit_code VARCHAR(40) NOT NULL,
  contact_name VARCHAR(50) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  address VARCHAR(500) NULL,
  audit_status TINYINT NOT NULL DEFAULT 0 COMMENT '0待提交 1待审核 2已通过 3已驳回',
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_enterprise_credit_code (credit_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE enterprise_user (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(50) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  role_code VARCHAR(30) NOT NULL DEFAULT 'BUYER',
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_enterprise_username (enterprise_id, username),
  CONSTRAINT fk_enterprise_user_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE agreement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agreement_no VARCHAR(40) NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  amount DECIMAL(14,2) NULL,
  effective_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0待生效 1生效中 2已停用 3已到期',
  version INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_agreement_no (agreement_no),
  KEY idx_agreement_enterprise_status (enterprise_id, status),
  CONSTRAINT fk_agreement_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT chk_agreement_dates CHECK (expiry_date >= effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE agreement_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agreement_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  agreement_price DECIMAL(12,2) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_agreement_sku (agreement_id, sku_id),
  KEY idx_agreement_item_sku (sku_id),
  CONSTRAINT fk_agreement_item_agreement FOREIGN KEY (agreement_id) REFERENCES agreement(id),
  CONSTRAINT fk_agreement_item_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id),
  CONSTRAINT chk_agreement_price CHECK (agreement_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE address (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  contact_name VARCHAR(50) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  province VARCHAR(50) NOT NULL,
  city VARCHAR(50) NOT NULL,
  district VARCHAR(50) NOT NULL,
  detail VARCHAR(500) NOT NULL,
  longitude DECIMAL(10,7) NULL,
  latitude DECIMAL(10,7) NULL,
  is_default TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_address_enterprise_user (enterprise_id, user_id),
  CONSTRAINT fk_address_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_address_user FOREIGN KEY (user_id) REFERENCES enterprise_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cart_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  solution_id BIGINT UNSIGNED NULL,
  quantity INT NOT NULL,
  selected TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cart_user_sku_context (user_id, sku_id, solution_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES enterprise_user(id),
  CONSTRAINT fk_cart_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id),
  CONSTRAINT chk_cart_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_main (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(40) NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  agreement_id BIGINT UNSIGNED NOT NULL,
  item_amount DECIMAL(14,2) NOT NULL,
  freight_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payable_amount DECIMAL(14,2) NOT NULL,
  payment_status TINYINT NOT NULL DEFAULT 0 COMMENT '0待付款 1待确认 2已确认',
  order_status TINYINT NOT NULL DEFAULT 0 COMMENT '0待付款 1待发货 2运输中 3已完成 4已取消',
  price_version VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  payment_due_at DATETIME NULL,
  cancelled_by_type VARCHAR(20) NULL,
  cancelled_by_id BIGINT UNSIGNED NULL,
  version INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  UNIQUE KEY uk_order_idempotency (enterprise_id, idempotency_key),
  KEY idx_order_enterprise_status (enterprise_id, order_status),
  CONSTRAINT fk_order_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES enterprise_user(id),
  CONSTRAINT fk_order_agreement FOREIGN KEY (agreement_id) REFERENCES agreement(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_sub (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_main_id BIGINT UNSIGNED NOT NULL,
  sub_order_no VARCHAR(48) NOT NULL,
  address_snapshot JSON NOT NULL,
  logistics_company VARCHAR(80) NULL,
  logistics_no VARCHAR(100) NULL,
  logistics_status VARCHAR(30) NULL,
  shipped_at DATETIME NULL,
  signed_at DATETIME NULL,
  status TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sub_order_no (sub_order_no),
  KEY idx_sub_main (order_main_id),
  CONSTRAINT fk_sub_main FOREIGN KEY (order_main_id) REFERENCES order_main(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_main_id BIGINT UNSIGNED NOT NULL,
  order_sub_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(14,2) NOT NULL,
  snapshot_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_item_main (order_main_id),
  KEY idx_order_item_sub (order_sub_id),
  CONSTRAINT fk_item_main FOREIGN KEY (order_main_id) REFERENCES order_main(id),
  CONSTRAINT fk_item_sub FOREIGN KEY (order_sub_id) REFERENCES order_sub(id),
  CONSTRAINT fk_item_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id),
  CONSTRAINT chk_order_item_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bank_transfer_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_main_id BIGINT UNSIGNED NOT NULL,
  bank_reference VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  received_at DATETIME NOT NULL,
  confirmer_admin_id BIGINT UNSIGNED NOT NULL,
  status TINYINT NOT NULL DEFAULT 0,
  remark VARCHAR(500) NULL,
  confirmed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_bank_reference (bank_reference),
  CONSTRAINT fk_transfer_order FOREIGN KEY (order_main_id) REFERENCES order_main(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stock_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku_id BIGINT UNSIGNED NOT NULL,
  order_main_id BIGINT UNSIGNED NULL,
  change_type VARCHAR(20) NOT NULL,
  quantity_delta INT NOT NULL,
  available_after INT NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_stock_request (request_id),
  KEY idx_stock_sku_created (sku_id, created_at),
  CONSTRAINT fk_stock_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id),
  CONSTRAINT fk_stock_order FOREIGN KEY (order_main_id) REFERENCES order_main(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE operation_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operator_type VARCHAR(20) NOT NULL,
  operator_id BIGINT UNSIGNED NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  ip VARCHAR(64) NULL,
  request_id VARCHAR(64) NOT NULL,
  result VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_operation_target (target_type, target_id),
  KEY idx_operation_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
