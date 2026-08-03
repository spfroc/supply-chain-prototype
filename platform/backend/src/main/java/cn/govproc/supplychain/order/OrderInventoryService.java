package cn.govproc.supplychain.order;

import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class OrderInventoryService {
    private final JdbcClient jdbc;

    public OrderInventoryService(JdbcClient jdbc) { this.jdbc = jdbc; }

    public void releaseReserved(long orderId) {
        jdbc.sql("""
            UPDATE product_sku sku JOIN (
              SELECT sku_id,SUM(quantity) quantity FROM order_item
              WHERE order_main_id=:orderId AND fulfillment_status=0 GROUP BY sku_id
            ) item ON item.sku_id=sku.id
            SET sku.reserved_stock=GREATEST(0,sku.reserved_stock-item.quantity)
            """).param("orderId",orderId).update();
        jdbc.sql("UPDATE order_item SET fulfillment_status=4 WHERE order_main_id=:orderId AND fulfillment_status=0")
            .param("orderId",orderId).update();
    }

    public void commitShipment(long orderId,long itemId) {
        Map<String,Object> item=jdbc.sql("""
            SELECT sku_id AS skuId,quantity,fulfillment_status AS status
            FROM order_item WHERE id=:itemId AND order_main_id=:orderId FOR UPDATE
            """).params(Map.of("itemId",itemId,"orderId",orderId)).query().singleRow();
        if(((Number)item.get("status")).intValue()!=0) return;
        int changed=jdbc.sql("""
            UPDATE product_sku SET stock=stock-:quantity,
              reserved_stock=GREATEST(0,reserved_stock-:quantity)
            WHERE id=:skuId AND stock>=:quantity
            """).params(Map.of("quantity",item.get("quantity"),"skuId",item.get("skuId"))).update();
        if(changed!=1) throw new IllegalStateException("商品库存不足，无法发货");
    }

    public void releaseItem(long orderId,long itemId) {
        Map<String,Object> item=jdbc.sql("""
            SELECT sku_id AS skuId,quantity,fulfillment_status AS status
            FROM order_item WHERE id=:itemId AND order_main_id=:orderId FOR UPDATE
            """).params(Map.of("itemId",itemId,"orderId",orderId)).query().singleRow();
        if(((Number)item.get("status")).intValue()!=0) return;
        jdbc.sql("UPDATE product_sku SET reserved_stock=GREATEST(0,reserved_stock-:quantity) WHERE id=:skuId")
            .params(Map.of("quantity",item.get("quantity"),"skuId",item.get("skuId"))).update();
    }
}
