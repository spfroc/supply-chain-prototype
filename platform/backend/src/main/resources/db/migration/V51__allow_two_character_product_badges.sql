ALTER TABLE product_spu
  DROP CHECK chk_product_badge_configuration;

ALTER TABLE product_spu
  ADD CONSTRAINT chk_product_badge_configuration CHECK (
    (badge_type IS NULL AND badge_platform_id IS NULL AND custom_badge IS NULL) OR
    (badge_type = 'AGREEMENT' AND badge_platform_id IS NULL AND custom_badge IS NULL) OR
    (badge_type = 'PLATFORM' AND badge_platform_id IS NOT NULL AND custom_badge IS NULL) OR
    (badge_type = 'CUSTOM' AND badge_platform_id IS NULL AND CHAR_LENGTH(TRIM(custom_badge)) BETWEEN 2 AND 5)
  );
