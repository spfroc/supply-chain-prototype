INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public,updated_by)
SELECT 'product.deliveryTemplates','[{"id":"delivery-default","title":"标准配送","content":"自营库存，支持全国配送；现货商品预计1至3个工作日送达，实际时效以收货地址和物流信息为准。","isDefault":true}]','JSON','商品模板','商品配送说明模板',0,1
WHERE NOT EXISTS(SELECT 1 FROM system_config WHERE config_key='product.deliveryTemplates');

INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public,updated_by)
SELECT 'product.afterSalesTemplates','[{"id":"after-sales-default","title":"标准售后政策","content":"商品签收后如发现质量问题，请在7日内联系企业采购管理员提交售后申请。非质量问题退换货以商品实际售后政策为准。","isDefault":true}]','JSON','商品模板','商品售后政策模板',0,1
WHERE NOT EXISTS(SELECT 1 FROM system_config WHERE config_key='product.afterSalesTemplates');
