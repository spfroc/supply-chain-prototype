ALTER TABLE product_sku
  ADD COLUMN title VARCHAR(300) NOT NULL DEFAULT '' COMMENT 'SKU展示标题' AFTER sku_code,
  ADD COLUMN gallery_json JSON NULL COMMENT 'SKU轮播图' AFTER sku_image;

UPDATE product_sku s
JOIN product_spu p ON p.id=s.spu_id
SET s.title=CONCAT(p.title,' ',JSON_UNQUOTE(JSON_EXTRACT(s.spec_json,'$'))),
    s.gallery_json=JSON_OBJECT('content',COALESCE(s.sku_image,''))
WHERE s.title='';

INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public)
SELECT 'inventory.defaultStock','10000','NUMBER','库存配置','新建商品 SKU 默认库存',0
WHERE NOT EXISTS(SELECT 1 FROM system_config WHERE config_key='inventory.defaultStock');
