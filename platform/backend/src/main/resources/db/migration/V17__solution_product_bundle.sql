ALTER TABLE portal_resource
  ADD COLUMN description TEXT NULL AFTER subtitle;

CREATE TABLE solution_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  solution_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  default_quantity INT NOT NULL DEFAULT 1,
  required_item TINYINT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_solution_sku (solution_id, sku_id),
  KEY idx_solution_item_solution (solution_id, deleted_at, sort_order),
  CONSTRAINT fk_solution_item_solution FOREIGN KEY (solution_id) REFERENCES portal_resource(id),
  CONSTRAINT fk_solution_item_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

