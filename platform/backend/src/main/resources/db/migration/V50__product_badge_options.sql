INSERT INTO system_option_group(option_code,option_name,control_type,sort_order,status)
SELECT 'PRODUCT_BADGE','商品角标','RADIO',25,1
WHERE NOT EXISTS(SELECT 1 FROM system_option_group WHERE option_code='PRODUCT_BADGE');

INSERT INTO system_option(option_type,label,option_value,sort_order,status)
SELECT 'PRODUCT_BADGE','品质精选','QUALITY',10,1
WHERE NOT EXISTS(SELECT 1 FROM system_option WHERE option_type='PRODUCT_BADGE' AND option_value='QUALITY');
