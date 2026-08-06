ALTER TABLE portal_resource
    ADD COLUMN price_prefix VARCHAR(100) NULL AFTER description;

UPDATE portal_resource
SET price_prefix = CASE
    WHEN title = '军采平台' THEN '军采'
    WHEN title = '国网平台' THEN '国网'
    WHEN title = '京东企业购' THEN '京东'
    WHEN title = '天猫企业购' THEN '天猫'
    ELSE LEFT(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(title, '企业采购', ''), '企业购', ''), '采购平台', ''), '平台', '')), 30)
END
WHERE resource_type = 'PLATFORM'
  AND (price_prefix IS NULL OR price_prefix = '');
