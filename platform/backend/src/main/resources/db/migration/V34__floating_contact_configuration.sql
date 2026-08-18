INSERT INTO system_config
  (config_key, config_value, value_type, group_name, description, is_public, updated_by)
VALUES
  ('contact.landline', '0531-86099058', 'TEXT', '联系方式', '悬浮联系方式：座机', 1, 1),
  ('contact.mobile', '13105315957', 'TEXT', '联系方式', '悬浮联系方式：手机', 1, 1),
  ('contact.wechatQr', 'https://qlyc.co/image/wx.png', 'TEXT', '联系方式', '悬浮联系方式：微信二维码图片地址', 1, 1),
  ('contact.email', 'Wangyunlei@yizhichan.co', 'TEXT', '联系方式', '悬浮联系方式：邮箱', 1, 1),
  ('contact.logo', 'https://qlyc.co/logo.png', 'TEXT', '联系方式', '悬浮联系方式：Logo 图片地址', 1, 1);
