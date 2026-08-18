CREATE TABLE portal_help_link (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  article_id BIGINT UNSIGNED NOT NULL,
  icon VARCHAR(30) NOT NULL DEFAULT 'SHIELD',
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_help_link_status_sort (status,sort_order),
  CONSTRAINT fk_help_link_article FOREIGN KEY (article_id) REFERENCES portal_resource(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO portal_help_link(title,article_id,icon,sort_order,status)
SELECT title,id,CASE MOD(ROW_NUMBER() OVER (ORDER BY sort_order,id)-1,4)
  WHEN 0 THEN 'SHIELD' WHEN 1 THEN 'USER' WHEN 2 THEN 'SERVICE' ELSE 'DELIVERY' END,
  ROW_NUMBER() OVER (ORDER BY sort_order,id)*10,1
FROM portal_resource WHERE resource_type='CONTENT' AND status=1 AND deleted_at IS NULL
ORDER BY sort_order,id LIMIT 8;
