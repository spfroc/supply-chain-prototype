-- Recover only values that can be read unambiguously from legacy product data.
-- Demo product IDs may be absent in a clean installation, so only insert rows whose
-- product and attribute records actually exist.
INSERT INTO product_attribute_value(product_id,attribute_id,value_text,option_ids)
SELECT seed.product_id,seed.attribute_id,seed.value_text,seed.option_ids
FROM (
  SELECT 1 product_id,1 attribute_id,'ThinkBook 16+' value_text,NULL option_ids UNION ALL
  SELECT 1,11,'Ultra 7',NULL UNION ALL SELECT 1,12,'32',JSON_ARRAY(6) UNION ALL SELECT 1,13,'1024',JSON_ARRAY(10) UNION ALL
  SELECT 2,18,'A4',JSON_ARRAY(22) UNION ALL SELECT 2,19,'70',JSON_ARRAY(24) UNION ALL SELECT 2,5,'8包/箱',NULL UNION ALL SELECT 2,21,'8',NULL UNION ALL
  SELECT 1001,1,'LaserJet Pro',NULL UNION ALL SELECT 1001,2,'白色',JSON_ARRAY(2) UNION ALL SELECT 1001,22,'激光',JSON_ARRAY(27) UNION ALL
  SELECT 1001,23,'黑白',JSON_ARRAY(29) UNION ALL SELECT 1001,26,'是',NULL UNION ALL SELECT 1002,14,'65',NULL UNION ALL
  SELECT 1003,31,'24',JSON_ARRAY(36) UNION ALL SELECT 1003,32,'千兆',JSON_ARRAY(39) UNION ALL
  SELECT 1004,2,'黑色',JSON_ARRAY(1) UNION ALL SELECT 1004,4,'网布',NULL UNION ALL
  SELECT 1005,2,'灰色',JSON_ARRAY(3) UNION ALL SELECT 1005,39,'32',JSON_ARRAY(50) UNION ALL
  SELECT 1006,45,'一级能效',JSON_ARRAY(56) UNION ALL SELECT 1006,46,'变频',JSON_ARRAY(59) UNION ALL
  SELECT 1007,5,'24支装',NULL UNION ALL SELECT 1007,50,'黑色',JSON_ARRAY(67) UNION ALL SELECT 1049,45,'一级能效',JSON_ARRAY(56)
) seed
JOIN product_spu product ON product.id=seed.product_id
JOIN attribute_definition attribute_row ON attribute_row.id=seed.attribute_id;

UPDATE product_spu SET attributes_json = NULL WHERE attributes_json IS NOT NULL;
