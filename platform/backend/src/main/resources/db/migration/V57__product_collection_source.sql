ALTER TABLE product_spu
  ADD COLUMN collection_platform VARCHAR(20) NULL AFTER custom_badge,
  ADD COLUMN collection_source_url VARCHAR(1000) NULL AFTER collection_platform;

UPDATE product_spu p
JOIN (
  SELECT ranked.product_id, ranked.platform, ranked.url
  FROM (
    SELECT i.product_id, i.platform, i.url,
      ROW_NUMBER() OVER (PARTITION BY i.product_id ORDER BY i.finished_at DESC, i.id DESC) AS row_num
    FROM collect_job_item i
    WHERE i.status='SUCCEEDED' AND i.product_id IS NOT NULL
  ) ranked
  WHERE ranked.row_num=1
) source ON source.product_id=p.id
SET p.collection_platform=source.platform,
    p.collection_source_url=source.url
WHERE p.collection_platform IS NULL OR p.collection_source_url IS NULL;

UPDATE product_spu p
JOIN product_sku s ON s.spu_id=p.id AND s.deleted_at IS NULL
  AND s.id=(SELECT MIN(s0.id) FROM product_sku s0 WHERE s0.spu_id=p.id AND s0.deleted_at IS NULL)
SET p.collection_platform='jd',
    p.collection_source_url=CONCAT('https://item.jd.com/',SUBSTRING(s.sku_code,4),'.html')
WHERE p.collection_platform IS NULL AND s.sku_code REGEXP '^JD-[0-9]+$';

UPDATE product_spu p
JOIN product_sku s ON s.spu_id=p.id AND s.deleted_at IS NULL
  AND s.id=(SELECT MIN(s0.id) FROM product_sku s0 WHERE s0.spu_id=p.id AND s0.deleted_at IS NULL)
SET p.collection_platform='huiecai',
    p.collection_source_url=CONCAT('http://hwly.miniappss.com/goodsInfo/',SUBSTRING(s.sku_code,6),'.html')
WHERE p.collection_platform IS NULL AND s.sku_code REGEXP '^HWLY-[0-9]+$';

UPDATE product_spu p
JOIN product_sku s ON s.spu_id=p.id AND s.deleted_at IS NULL
  AND s.id=(SELECT MIN(s0.id) FROM product_sku s0 WHERE s0.spu_id=p.id AND s0.deleted_at IS NULL)
SET p.collection_platform='qilu',
    p.collection_source_url=CONCAT(
      'https://ggzyjyzx.shandong.gov.cn:8182/gpfa-main-web/goodslibrary/gpfa/goodsDetail?goodspriceguid=',
      SUBSTRING(s.sku_code,6),'&platform=3100'
    )
WHERE p.collection_platform IS NULL AND s.sku_code LIKE 'QLYC-%';

CREATE INDEX idx_product_collection_platform ON product_spu(collection_platform);
