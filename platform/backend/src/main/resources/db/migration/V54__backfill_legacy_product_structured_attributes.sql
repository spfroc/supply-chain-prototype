-- Recover only values that can be read unambiguously from the legacy product title or SKU specification.
INSERT INTO product_attribute_value(product_id,attribute_id,value_text,option_ids) VALUES
  (1,1,'ThinkBook 16+',NULL),(1,11,'Ultra 7',NULL),(1,12,'32',JSON_ARRAY(6)),(1,13,'1024',JSON_ARRAY(10)),
  (2,18,'A4',JSON_ARRAY(22)),(2,19,'70',JSON_ARRAY(24)),(2,5,'8包/箱',NULL),(2,21,'8',NULL),
  (1001,1,'LaserJet Pro',NULL),(1001,2,'白色',JSON_ARRAY(2)),(1001,22,'激光',JSON_ARRAY(27)),
  (1001,23,'黑白',JSON_ARRAY(29)),(1001,26,'是',NULL),
  (1002,14,'65',NULL),
  (1003,31,'24',JSON_ARRAY(36)),(1003,32,'千兆',JSON_ARRAY(39)),
  (1004,2,'黑色',JSON_ARRAY(1)),(1004,4,'网布',NULL),
  (1005,2,'灰色',JSON_ARRAY(3)),(1005,39,'32',JSON_ARRAY(50)),
  (1006,45,'一级能效',JSON_ARRAY(56)),(1006,46,'变频',JSON_ARRAY(59)),
  (1007,5,'24支装',NULL),(1007,50,'黑色',JSON_ARRAY(67)),
  (1049,45,'一级能效',JSON_ARRAY(56));
