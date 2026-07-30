ALTER TABLE product_spu
  ADD COLUMN delivery_description TEXT NULL AFTER detail_html,
  ADD COLUMN after_sales_html LONGTEXT NULL AFTER delivery_description;

UPDATE product_spu
SET delivery_description = '自营库存，支持全国配送；现货商品预计1至3个工作日送达，实际时效以收货地址和物流信息为准。',
    after_sales_html = '<h3>售后服务</h3><p>商品签收后如发现质量问题，请在7日内联系企业采购管理员提交售后申请。非质量问题退换货以商品实际售后政策为准。</p>'
WHERE deleted_at IS NULL;
