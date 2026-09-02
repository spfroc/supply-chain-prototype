CREATE TABLE enterprise_finance_profile (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  invoice_title VARCHAR(200) NOT NULL,
  tax_no VARCHAR(40) NULL,
  invoice_type VARCHAR(30) NOT NULL DEFAULT '增值税普通发票',
  recipient_email VARCHAR(160) NULL,
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  payment_term_days INT NOT NULL DEFAULT 30,
  credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_finance_profile_enterprise (enterprise_id),
  CONSTRAINT fk_finance_profile_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reconciliation_statement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  statement_no VARCHAR(40) NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  order_count INT NOT NULL DEFAULT 0,
  item_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  freight_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  payable_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1 COMMENT '0草稿 1待确认 2已确认 3已结清 4已作废',
  due_date DATE NULL,
  generated_by BIGINT UNSIGNED NOT NULL,
  confirmed_by BIGINT UNSIGNED NULL,
  confirmed_at DATETIME NULL,
  paid_at DATETIME NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_statement_no (statement_no),
  KEY idx_statement_enterprise_period (enterprise_id, period_start, period_end),
  KEY idx_statement_enterprise_status (enterprise_id, status, due_date),
  CONSTRAINT fk_statement_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_statement_generator FOREIGN KEY (generated_by) REFERENCES enterprise_user(id),
  CONSTRAINT fk_statement_confirmer FOREIGN KEY (confirmed_by) REFERENCES enterprise_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reconciliation_statement_order (
  statement_id BIGINT UNSIGNED NOT NULL,
  order_main_id BIGINT UNSIGNED NOT NULL,
  payable_amount DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (statement_id, order_main_id),
  UNIQUE KEY uk_statement_order (order_main_id),
  CONSTRAINT fk_statement_order_statement FOREIGN KEY (statement_id) REFERENCES reconciliation_statement(id),
  CONSTRAINT fk_statement_order_order FOREIGN KEY (order_main_id) REFERENCES order_main(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoice_application (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_no VARCHAR(40) NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  applicant_user_id BIGINT UNSIGNED NOT NULL,
  statement_id BIGINT UNSIGNED NULL,
  invoice_title VARCHAR(200) NOT NULL,
  tax_no VARCHAR(40) NOT NULL,
  invoice_type VARCHAR(30) NOT NULL,
  recipient_email VARCHAR(160) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0待处理 1开票中 2已开具 3已驳回',
  invoice_no VARCHAR(80) NULL,
  invoice_file_url VARCHAR(500) NULL,
  processed_by BIGINT UNSIGNED NULL,
  processed_at DATETIME NULL,
  failure_reason VARCHAR(500) NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_invoice_application_no (application_no),
  KEY idx_invoice_application_enterprise (enterprise_id, status, created_at),
  CONSTRAINT fk_invoice_application_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_invoice_application_user FOREIGN KEY (applicant_user_id) REFERENCES enterprise_user(id),
  CONSTRAINT fk_invoice_application_statement FOREIGN KEY (statement_id) REFERENCES reconciliation_statement(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoice_application_order (
  application_id BIGINT UNSIGNED NOT NULL,
  order_main_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (application_id, order_main_id),
  UNIQUE KEY uk_invoice_application_order (order_main_id),
  CONSTRAINT fk_invoice_application_order_application FOREIGN KEY (application_id) REFERENCES invoice_application(id),
  CONSTRAINT fk_invoice_application_order_order FOREIGN KEY (order_main_id) REFERENCES order_main(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO enterprise_finance_profile(enterprise_id,invoice_title,tax_no)
SELECT id,name,credit_code FROM enterprise WHERE deleted_at IS NULL;
