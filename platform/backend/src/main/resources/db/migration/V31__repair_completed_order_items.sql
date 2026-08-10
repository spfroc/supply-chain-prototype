UPDATE order_item oi
JOIN order_main o ON o.id=oi.order_main_id
SET oi.fulfillment_status=3,
    oi.logistics_status=COALESCE(NULLIF(oi.logistics_status,''),'已签收')
WHERE o.order_status=3
  AND oi.fulfillment_status IN (0,1,2);
