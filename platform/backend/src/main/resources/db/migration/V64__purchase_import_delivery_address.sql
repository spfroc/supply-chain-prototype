ALTER TABLE purchase_import_item
  ADD COLUMN address_id BIGINT UNSIGNED NULL AFTER sku_id,
  ADD CONSTRAINT fk_purchase_import_item_address FOREIGN KEY (address_id) REFERENCES address(id);

ALTER TABLE cart_item
  ADD COLUMN preferred_address_id BIGINT UNSIGNED NULL AFTER solution_id,
  ADD CONSTRAINT fk_cart_preferred_address FOREIGN KEY (preferred_address_id) REFERENCES address(id);
