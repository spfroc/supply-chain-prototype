ALTER TABLE product_sku ADD COLUMN sku_image VARCHAR(500) NULL AFTER spec_json;

UPDATE product_sku sku JOIN product_spu spu ON spu.id=sku.spu_id
SET sku.sku_image=spu.main_image
WHERE sku.sku_image IS NULL OR sku.sku_image='';
