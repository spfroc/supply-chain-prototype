INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public)
VALUES
  ('footer.aboutTitle','关于壹采','TEXT','门户页脚','关于栏目标题',1),
  ('footer.officialTitle','官方平台','TEXT','门户页脚','官方平台栏目标题',1),
  ('footer.serviceTitle','我们的服务','TEXT','门户页脚','服务栏目标题',1),
  ('footer.contactTitle','联系我们','TEXT','门户页脚','联系栏目标题',1)
ON DUPLICATE KEY UPDATE description=VALUES(description),is_public=1;
