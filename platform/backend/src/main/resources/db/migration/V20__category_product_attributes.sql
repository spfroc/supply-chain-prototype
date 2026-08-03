CREATE TABLE attribute_definition (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(100) NOT NULL,
  group_name VARCHAR(100) NOT NULL DEFAULT '规格参数',
  attribute_type VARCHAR(20) NOT NULL DEFAULT 'BASIC' COMMENT 'BASIC基础属性 SPEC销售规格 EXTENDED扩展属性',
  input_type VARCHAR(20) NOT NULL DEFAULT 'TEXT' COMMENT 'TEXT NUMBER SELECT RADIO CHECKBOX SWITCH DATE',
  unit VARCHAR(30) NULL,
  required_flag TINYINT NOT NULL DEFAULT 0,
  filterable TINYINT NOT NULL DEFAULT 0,
  searchable TINYINT NOT NULL DEFAULT 0,
  visible_flag TINYINT NOT NULL DEFAULT 1,
  allow_custom TINYINT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_attribute_code (code),
  KEY idx_attribute_status_sort (status,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attribute_option (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attribute_id BIGINT UNSIGNED NOT NULL,
  option_code VARCHAR(80) NOT NULL,
  option_label VARCHAR(100) NOT NULL,
  color_value VARCHAR(30) NULL,
  image_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_attribute_option_code (attribute_id,option_code),
  KEY idx_attribute_option_sort (attribute_id,status,sort_order),
  CONSTRAINT fk_attribute_option_definition FOREIGN KEY (attribute_id) REFERENCES attribute_definition(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE category_attribute (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  attribute_id BIGINT UNSIGNED NOT NULL,
  required_override TINYINT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_category_attribute (category_id,attribute_id),
  CONSTRAINT fk_category_attribute_category FOREIGN KEY (category_id) REFERENCES category(id),
  CONSTRAINT fk_category_attribute_definition FOREIGN KEY (attribute_id) REFERENCES attribute_definition(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_attribute_value (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  attribute_id BIGINT UNSIGNED NOT NULL,
  value_text TEXT NULL,
  option_ids JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_attribute (product_id,attribute_id),
  CONSTRAINT fk_product_attribute_product FOREIGN KEY (product_id) REFERENCES product_spu(id),
  CONSTRAINT fk_product_attribute_definition FOREIGN KEY (attribute_id) REFERENCES attribute_definition(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO attribute_definition(code,name,group_name,attribute_type,input_type,unit,required_flag,filterable,visible_flag,sort_order) VALUES
('MODEL','型号','基本信息','BASIC','TEXT',NULL,1,0,1,10),
('COLOR','颜色','基本信息','SPEC','SELECT',NULL,0,1,1,20),
('WARRANTY','质保期','服务信息','EXTENDED','NUMBER','个月',0,0,1,30),
('MATERIAL','材质','规格参数','BASIC','TEXT',NULL,0,1,1,40),
('PACK_SIZE','包装规格','规格参数','SPEC','TEXT',NULL,0,1,1,50);

INSERT INTO attribute_option(attribute_id,option_code,option_label,sort_order)
SELECT id,'BLACK','黑色',10 FROM attribute_definition WHERE code='COLOR';
INSERT INTO attribute_option(attribute_id,option_code,option_label,sort_order)
SELECT id,'WHITE','白色',20 FROM attribute_definition WHERE code='COLOR';
INSERT INTO attribute_option(attribute_id,option_code,option_label,sort_order)
SELECT id,'GRAY','灰色',30 FROM attribute_definition WHERE code='COLOR';

INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c CROSS JOIN attribute_definition a
WHERE c.level=1 AND c.deleted_at IS NULL AND a.code IN ('MODEL','WARRANTY');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c CROSS JOIN attribute_definition a
WHERE c.level=3 AND c.deleted_at IS NULL AND a.code IN ('COLOR','MATERIAL','PACK_SIZE');
