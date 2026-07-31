ALTER TABLE order_item
  ADD COLUMN fulfillment_status TINYINT NOT NULL DEFAULT 0 COMMENT '0待发货 1已发货 2运输中 3已签收 4已取消',
  ADD COLUMN logistics_company VARCHAR(80) NULL,
  ADD COLUMN logistics_no VARCHAR(100) NULL,
  ADD COLUMN logistics_status VARCHAR(120) NULL,
  ADD COLUMN shipped_at DATETIME NULL;

CREATE INDEX idx_order_item_fulfillment ON order_item(order_main_id, fulfillment_status);
