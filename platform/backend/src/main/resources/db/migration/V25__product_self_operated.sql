ALTER TABLE product_spu
    ADD COLUMN self_operated TINYINT NOT NULL DEFAULT 1 COMMENT '是否自营：1自营，0非自营' AFTER brand_id;

