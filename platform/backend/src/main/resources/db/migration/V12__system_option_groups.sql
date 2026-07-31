CREATE TABLE system_option_group (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  option_code VARCHAR(60) NOT NULL,
  option_name VARCHAR(120) NOT NULL,
  control_type VARCHAR(30) NOT NULL DEFAULT 'RADIO',
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_system_option_group_code (option_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_option_group
  (option_code, option_name, control_type, sort_order, status)
VALUES
  ('LOGISTICS_COMPANY', '物流公司', 'RADIO', 10, 1);
