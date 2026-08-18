INSERT INTO system_config
  (config_key, config_value, value_type, group_name, description, is_public, updated_by)
VALUES
  ('footer.about', '壹采是专业的政企采购电商服务平台，为供应商企业提供齐鲁云采、框架协议、泉E采等政府采购平台的一站式入驻与运营服务。', 'TEXT', '门户页脚', '关于我们', 1, 1),
  ('footer.address', '山东省济南市市中区汇宝大厦2106A', 'TEXT', '门户页脚', '联系地址', 1, 1),
  ('footer.copyrightYears', '2023-2025', 'TEXT', '门户页脚', '版权年份', 1, 1),
  ('footer.companyName', '山东壹知产数字科技有限公司', 'TEXT', '门户页脚', '公司名称', 1, 1),
  ('platform.telecomLicense', '鲁B2-20210548', 'TEXT', '门户页脚', '电信增值业务许可证', 1, 1)
ON DUPLICATE KEY UPDATE config_key=VALUES(config_key);

UPDATE system_config SET config_value='鲁ICP备2021004355号' WHERE config_key='platform.icpFiling' AND config_value='';
UPDATE system_config SET config_value='鲁公网安备 37010302001675' WHERE config_key='platform.policeFiling' AND config_value='';
UPDATE system_config SET group_name='门户页脚' WHERE config_key IN ('platform.icpFiling','platform.policeFiling');
