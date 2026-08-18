INSERT INTO system_option_group(option_code,option_name,control_type,sort_order,status)
SELECT 'PRODUCT_SERVICE','商品服务','SELECT_MULTIPLE',20,1
WHERE NOT EXISTS (SELECT 1 FROM system_option_group WHERE option_code='PRODUCT_SERVICE');

INSERT INTO system_option(option_type,label,option_value,sort_order,status)
SELECT 'PRODUCT_SERVICE','自营正品','SELF_AUTHENTIC',10,1
WHERE NOT EXISTS (SELECT 1 FROM system_option WHERE option_type='PRODUCT_SERVICE' AND option_value='SELF_AUTHENTIC');
INSERT INTO system_option(option_type,label,option_value,sort_order,status)
SELECT 'PRODUCT_SERVICE','全国配送','NATIONWIDE_DELIVERY',20,1
WHERE NOT EXISTS (SELECT 1 FROM system_option WHERE option_type='PRODUCT_SERVICE' AND option_value='NATIONWIDE_DELIVERY');
INSERT INTO system_option(option_type,label,option_value,sort_order,status)
SELECT 'PRODUCT_SERVICE','统一对账','UNIFIED_RECONCILIATION',30,1
WHERE NOT EXISTS (SELECT 1 FROM system_option WHERE option_type='PRODUCT_SERVICE' AND option_value='UNIFIED_RECONCILIATION');

CREATE TABLE product_service_option (
  product_id BIGINT UNSIGNED NOT NULL,
  option_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(product_id,option_id),
  CONSTRAINT fk_product_service_product FOREIGN KEY(product_id) REFERENCES product_spu(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_service_option FOREIGN KEY(option_id) REFERENCES system_option(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO product_service_option(product_id,option_id)
SELECT p.id,o.id FROM product_spu p JOIN system_option o ON o.option_type='PRODUCT_SERVICE'
WHERE p.deleted_at IS NULL;
