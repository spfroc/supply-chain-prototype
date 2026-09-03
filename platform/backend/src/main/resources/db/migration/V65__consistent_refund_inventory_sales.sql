ALTER TABLE order_item
  ADD COLUMN refunded_quantity INT NOT NULL DEFAULT 0 COMMENT '已退款或退货数量' AFTER quantity;

ALTER TABLE after_sale_request
  ADD COLUMN result_applied TINYINT NOT NULL DEFAULT 0 COMMENT '完成结果是否已计入库存销量和退款' AFTER processed_at;

ALTER TABLE order_main
  MODIFY COLUMN refund_status TINYINT NOT NULL DEFAULT 0 COMMENT '0未退款 1已全额退款 2部分退款';

UPDATE order_main
SET refund_status=2
WHERE refund_status=1 AND COALESCE(refund_amount,0)<payable_amount;

UPDATE order_item oi JOIN (
  SELECT a.order_item_id,SUM(a.requested_quantity) quantity
  FROM after_sale_request a
  WHERE a.status=4 AND a.service_type IN ('RETURN','REFUND')
  GROUP BY a.order_item_id
) completed ON completed.order_item_id=oi.id
SET oi.refunded_quantity=LEAST(oi.quantity,completed.quantity);

INSERT IGNORE INTO stock_ledger(sku_id,order_main_id,change_type,quantity_delta,available_after,request_id)
SELECT oi.sku_id,a.order_main_id,'AFTER_SALE_RETURN',SUM(a.requested_quantity),
  s.stock-s.reserved_stock+SUM(a.requested_quantity),CONCAT('v65-return-',a.order_main_id,'-',oi.sku_id)
FROM after_sale_request a JOIN order_item oi ON oi.id=a.order_item_id JOIN product_sku s ON s.id=oi.sku_id
WHERE a.status=4 AND a.service_type='RETURN'
GROUP BY oi.sku_id,a.order_main_id,s.stock,s.reserved_stock;

UPDATE product_sku s JOIN (
  SELECT oi.sku_id,SUM(a.requested_quantity) quantity
  FROM after_sale_request a JOIN order_item oi ON oi.id=a.order_item_id
  WHERE a.status=4 AND a.service_type='RETURN'
  GROUP BY oi.sku_id
) returned ON returned.sku_id=s.id
SET s.stock=s.stock+returned.quantity;

UPDATE order_main o JOIN (
  SELECT a.order_main_id,SUM(COALESCE(a.requested_amount,
    ROUND(oi.total_price*a.requested_quantity/oi.quantity,2))) amount
  FROM after_sale_request a JOIN order_item oi ON oi.id=a.order_item_id
  WHERE a.status=4 AND a.service_type IN ('RETURN','REFUND')
  GROUP BY a.order_main_id
) completed ON completed.order_main_id=o.id
SET o.refund_amount=GREATEST(COALESCE(o.refund_amount,0),completed.amount),
  o.refund_status=CASE WHEN GREATEST(COALESCE(o.refund_amount,0),completed.amount)>=o.payable_amount THEN 1 ELSE 2 END,
  o.refunded_at=COALESCE(o.refunded_at,NOW());

UPDATE after_sale_request SET result_applied=1 WHERE status=4;
