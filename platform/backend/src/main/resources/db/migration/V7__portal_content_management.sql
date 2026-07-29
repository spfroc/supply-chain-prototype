CREATE TABLE portal_resource (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  resource_type VARCHAR(30) NOT NULL COMMENT 'NAVIGATION BANNER PLATFORM SOLUTION CONTENT',
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(500) NULL,
  image_url VARCHAR(500) NULL,
  link_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_portal_resource_type_status (resource_type, status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO portal_resource (resource_type,title,subtitle,link_url,sort_order,status) VALUES
  ('NAVIGATION','首页','平台首页','/web/',10,1),
  ('NAVIGATION','办公集采','全部自营商品','/web/?view=products',20,1),
  ('NAVIGATION','场景方案','企业采购解决方案','/web/?view=solutions',30,1),
  ('NAVIGATION','平台比价','多平台价格参考','/web/?view=platforms',40,1),
  ('BANNER','2026 政企集采季','企业协议专属价格 · 自营库存 · 多地址配送','/web/?view=products',10,1),
  ('BANNER','会议空间焕新计划','会议平板、网络设备与办公家具一站配齐','/web/?view=solutions',20,1),
  ('PLATFORM','京东企业购','企业采购价格参考','https://b.jd.com',10,1),
  ('PLATFORM','天猫企业购','办公商品价格参考','https://www.tmall.com',20,1),
  ('SOLUTION','智慧办公整体方案','电脑、打印设备与办公耗材组合采购','/web/?view=solutions',10,1),
  ('SOLUTION','智能会议室改造','会议平板、网络与安装服务一站交付','/web/?view=solutions',20,1),
  ('SOLUTION','园区网络升级','交换机与网络设备集中采购方案','/web/?view=solutions',30,1),
  ('CONTENT','采购指南','了解企业协议价、银行转账和配送规则','/web/?view=content',10,1),
  ('CONTENT','售后服务说明','自营商品售后及退换货处理说明','/web/?view=content',20,1);

