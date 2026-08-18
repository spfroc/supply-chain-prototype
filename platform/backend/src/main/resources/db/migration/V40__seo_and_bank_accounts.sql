CREATE TABLE payment_bank_account (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_name VARCHAR(150) NOT NULL,
  bank_name VARCHAR(150) NOT NULL,
  account_number VARCHAR(80) NOT NULL,
  branch_name VARCHAR(200) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id), KEY idx_bank_account_status_sort(status,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE order_main ADD COLUMN payment_bank_account_id BIGINT UNSIGNED NULL AFTER payment_due_at,
  ADD COLUMN payment_bank_snapshot JSON NULL AFTER payment_bank_account_id,
  ADD CONSTRAINT fk_order_payment_bank FOREIGN KEY(payment_bank_account_id) REFERENCES payment_bank_account(id);

INSERT INTO payment_bank_account(account_name,bank_name,account_number,branch_name,sort_order,status)
VALUES('山东壹知产数字科技有限公司','待配置收款银行','请在后台配置银行账号','',10,1);

INSERT INTO system_config(config_key,config_value,value_type,group_name,description,is_public,updated_by) VALUES
('seo.title','山东壹知产供应链数字平台','TEXT','SEO与GEO','网站标题',1,1),
('seo.description','面向政企客户的办公集采、框架协议、国网及军采平台商品采购服务。','TEXT','SEO与GEO','网站描述',1,1),
('seo.keywords','办公集采,政企采购,框架协议,国网平台,军采平台,山东政府采购','TEXT','SEO与GEO','SEO关键词',1,1),
('seo.geoKeywords','山东政企采购,济南办公集采,山东框架协议采购,企业供应链采购','TEXT','SEO与GEO','GEO地域与生成式搜索关键词',1,1),
('seo.organizationName','山东壹知产数字科技有限公司','TEXT','SEO与GEO','结构化数据组织名称',1,1);
