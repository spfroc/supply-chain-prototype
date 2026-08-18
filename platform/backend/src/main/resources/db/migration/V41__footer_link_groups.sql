CREATE TABLE portal_footer_link (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  link_group VARCHAR(30) NOT NULL,
  title VARCHAR(100) NOT NULL,
  link_url VARCHAR(500) NOT NULL,
  open_target VARCHAR(10) NOT NULL DEFAULT 'SELF',
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY(id), KEY idx_footer_link_group_status_sort(link_group,status,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO portal_footer_link(link_group,title,link_url,open_target,sort_order,status)
SELECT 'OFFICIAL',title,COALESCE(NULLIF(link_url,''),CONCAT('/web/platforms/',id,'/products')),'SELF',sort_order,1
FROM portal_resource WHERE resource_type='PLATFORM' AND status=1 AND deleted_at IS NULL;

INSERT INTO portal_footer_link(link_group,title,link_url,open_target,sort_order,status)
SELECT 'SERVICE',h.title,CONCAT('/web/articles/',h.article_id),'SELF',h.sort_order,h.status
FROM portal_help_link h WHERE h.deleted_at IS NULL;
