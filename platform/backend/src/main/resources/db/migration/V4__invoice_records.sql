CREATE TABLE invoice_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  order_main_id BIGINT UNSIGNED NOT NULL,
  invoice_no VARCHAR(80) NULL,
  title VARCHAR(200) NOT NULL,
  tax_no VARCHAR(40) NOT NULL,
  invoice_type VARCHAR(30) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0待处理 1第三方处理中 2已开具 3失败',
  issued_at DATETIME NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_invoice_enterprise (enterprise_id, created_at),
  CONSTRAINT fk_invoice_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprise(id),
  CONSTRAINT fk_invoice_order FOREIGN KEY (order_main_id) REFERENCES order_main(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO invoice_record
  (enterprise_id, order_main_id, invoice_no, title, tax_no, invoice_type, amount, status, issued_at, remark)
VALUES
  (1, 2, 'INV202607260018', '山东高速数字科技有限公司', '91370000DEMO000001',
   '增值税专用发票', 372.00, 2, '2026-07-27 10:20:00', '由第三方开具，平台留档');
