CREATE INDEX idx_spu_deleted_id ON product_spu(deleted_at,id);
CREATE INDEX idx_sku_spu_deleted_id ON product_sku(spu_id,deleted_at,id);
