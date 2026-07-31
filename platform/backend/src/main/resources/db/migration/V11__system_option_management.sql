CREATE TABLE system_option (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  option_type VARCHAR(60) NOT NULL,
  label VARCHAR(120) NOT NULL,
  option_value VARCHAR(160) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_system_option_type_value (option_type, option_value),
  KEY idx_system_option_query (option_type, status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_option (option_type, label, option_value, sort_order, status) VALUES
  ('LOGISTICS_COMPANY', '顺丰速运', '顺丰速运', 10, 1),
  ('LOGISTICS_COMPANY', '京东物流', '京东物流', 20, 1),
  ('LOGISTICS_COMPANY', '中国邮政速递物流（EMS）', '中国邮政速递物流（EMS）', 30, 1),
  ('LOGISTICS_COMPANY', '中通快递', '中通快递', 40, 1),
  ('LOGISTICS_COMPANY', '圆通速递', '圆通速递', 50, 1),
  ('LOGISTICS_COMPANY', '申通快递', '申通快递', 60, 1),
  ('LOGISTICS_COMPANY', '韵达速递', '韵达速递', 70, 1),
  ('LOGISTICS_COMPANY', '极兔速递', '极兔速递', 80, 1),
  ('LOGISTICS_COMPANY', '德邦快递', '德邦快递', 90, 1),
  ('LOGISTICS_COMPANY', '跨越速运', '跨越速运', 100, 1);
