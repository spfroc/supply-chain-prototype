-- Only unshipped items in active orders should reserve inventory.
UPDATE product_sku SET reserved_stock=0;

UPDATE product_sku sku JOIN (
  SELECT oi.sku_id,SUM(oi.quantity) quantity
  FROM order_item oi JOIN order_main om ON om.id=oi.order_main_id
  WHERE oi.fulfillment_status=0 AND om.order_status NOT IN (3,4) AND om.refund_status=0
  GROUP BY oi.sku_id
) pending ON pending.sku_id=sku.id
SET sku.reserved_stock=LEAST(sku.stock,pending.quantity);
