INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public,updated_by)
SELECT 'platform.logo','', 'TEXT','平台信息','网站 Logo（建议正方形 PNG）',1,1
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key='platform.logo');

INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public,updated_by)
SELECT 'platform.englishName','SUPPLY CHAIN', 'TEXT','平台信息','网站英文副标识',1,1
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key='platform.englishName');

INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public,updated_by)
SELECT 'platform.slogan','自营正品 · 全国配送', 'TEXT','平台信息','网站顶部宣传语',1,1
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key='platform.slogan');
