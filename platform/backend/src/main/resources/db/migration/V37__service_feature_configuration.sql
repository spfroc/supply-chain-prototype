CREATE TABLE portal_service_feature (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  image_url VARCHAR(500) NOT NULL,
  title VARCHAR(20) NOT NULL,
  subtitle VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_service_feature_status_sort (status,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO portal_service_feature(image_url,title,subtitle,sort_order,status) VALUES
('/web/service-icons/shield.svg','正品保障','自营商品品质保证',10,1),
('/web/service-icons/trust.svg','授信守信','协议价格统一对账',20,1),
('/web/service-icons/service.svg','专属服务','企业客户一对一服务',30,1),
('/web/service-icons/delivery.svg','全国配送','多地拆分物流可查询',40,1);
