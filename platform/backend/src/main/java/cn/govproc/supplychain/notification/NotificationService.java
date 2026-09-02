package cn.govproc.supplychain.notification;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {
    private final JdbcClient jdbc;
    public NotificationService(JdbcClient jdbc){this.jdbc=jdbc;}

    public void send(long enterpriseId,long userId,String type,String title,String content,String link,String businessType,Long businessId,String dedupeKey){
        jdbc.sql("""
          INSERT IGNORE INTO notification_message(enterprise_id,user_id,message_type,title,content,link_url,business_type,business_id,dedupe_key)
          VALUES(:enterpriseId,:userId,:type,:title,:content,:link,:businessType,:businessId,:dedupeKey)
          """).param("enterpriseId",enterpriseId).param("userId",userId).param("type",type).param("title",title)
          .param("content",content).param("link",link).param("businessType",businessType).param("businessId",businessId).param("dedupeKey",dedupeKey).update();
    }

    public void notifyAvailableStockForSpu(long spuId){
        var rows=jdbc.sql("""
          SELECT a.id,a.enterprise_id AS enterpriseId,a.user_id AS userId,a.sku_id AS skuId,p.title,s.sku_code AS skuCode
          FROM stock_arrival_subscription a JOIN product_sku s ON s.id=a.sku_id JOIN product_spu p ON p.id=s.spu_id
          WHERE s.spu_id=:spuId AND a.status=1 AND s.status=1 AND s.deleted_at IS NULL AND s.stock-s.reserved_stock>0
          """).param("spuId",spuId).query().listOfRows();
        for(var row:rows){long subscriptionId=((Number)row.get("id")).longValue();long skuId=((Number)row.get("skuId")).longValue();
            send(((Number)row.get("enterpriseId")).longValue(),((Number)row.get("userId")).longValue(),"STOCK","订阅商品已到货",
              row.get("title")+"（"+row.get("skuCode")+"）已有库存，可进入商品详情采购。","/web/products/"+spuId,"SKU",skuId,"stock-arrival-"+subscriptionId);
            jdbc.sql("UPDATE stock_arrival_subscription SET status=2,notified_at=NOW() WHERE id=:id AND status=1").param("id",subscriptionId).update();
        }
    }
}
