ALTER TABLE product_spu
  ADD COLUMN badge_type VARCHAR(20) NULL COMMENT 'AGREEMENT PLATFORM CUSTOM',
  ADD COLUMN badge_platform_id BIGINT UNSIGNED NULL,
  ADD COLUMN custom_badge VARCHAR(5) NULL,
  ADD CONSTRAINT fk_product_badge_platform FOREIGN KEY (badge_platform_id) REFERENCES portal_resource(id),
  ADD CONSTRAINT chk_product_badge_configuration CHECK (
    (badge_type IS NULL AND badge_platform_id IS NULL AND custom_badge IS NULL) OR
    (badge_type = 'AGREEMENT' AND badge_platform_id IS NULL AND custom_badge IS NULL) OR
    (badge_type = 'PLATFORM' AND badge_platform_id IS NOT NULL AND custom_badge IS NULL) OR
    (badge_type = 'CUSTOM' AND badge_platform_id IS NULL AND CHAR_LENGTH(TRIM(custom_badge)) BETWEEN 3 AND 5)
  );
