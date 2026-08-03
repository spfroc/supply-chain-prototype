ALTER TABLE order_main
  ADD COLUMN refund_status TINYINT NOT NULL DEFAULT 0 COMMENT '0未退款 1已退款' AFTER order_status,
  ADD COLUMN refund_amount DECIMAL(18,2) NULL AFTER refund_status,
  ADD COLUMN refund_reason VARCHAR(500) NULL AFTER refund_amount,
  ADD COLUMN refunded_at DATETIME NULL AFTER refund_reason;
