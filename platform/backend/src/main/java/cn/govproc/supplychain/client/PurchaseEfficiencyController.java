package cn.govproc.supplychain.client;

import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.auth.EnterpriseAuthorizationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/client/purchase-tools")
public class PurchaseEfficiencyController {
    private final JdbcClient jdbc;private final ClientAuthService auth;private final EnterpriseAuthorizationService authorization;
    public PurchaseEfficiencyController(JdbcClient jdbc,ClientAuthService auth,EnterpriseAuthorizationService authorization){this.jdbc=jdbc;this.auth=auth;this.authorization=authorization;}

    @GetMapping("/frequent-items")
    List<Map<String,Object>> frequentItems(){authorization.require("purchase:view");return jdbc.sql("""
      SELECT f.id,f.sku_id AS skuId,f.default_quantity AS defaultQuantity,f.remark,f.sort_order AS sortOrder,
        p.id AS productId,p.title,COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,s.sku_code AS skuCode,
        CAST(s.spec_json AS CHAR) AS specJson,s.market_price AS marketPrice,s.member_price AS memberPrice,
        s.stock-s.reserved_stock AS availableStock,s.status AS skuStatus
      FROM frequent_purchase_item f JOIN product_sku s ON s.id=f.sku_id JOIN product_spu p ON p.id=s.spu_id
      WHERE f.user_id=:userId AND s.deleted_at IS NULL AND p.deleted_at IS NULL ORDER BY f.sort_order,f.id DESC
      """).param("userId",userId()).query().listOfRows();}
    @GetMapping("/frequent-items/{skuId}") Map<String,Object> frequentState(@PathVariable long skuId){authorization.require("purchase:view");int count=jdbc.sql("SELECT COUNT(*) FROM frequent_purchase_item WHERE user_id=:userId AND sku_id=:skuId").params(Map.of("userId",userId(),"skuId",skuId)).query(Integer.class).single();return Map.of("favorite",count>0);}

    @PostMapping("/frequent-items") @ResponseStatus(HttpStatus.CREATED)
    void addFrequent(@Valid @RequestBody FrequentRequest request){authorization.require("purchase:manage");requireSku(request.skuId());jdbc.sql("""
      INSERT INTO frequent_purchase_item(enterprise_id,user_id,sku_id,default_quantity,remark)
      VALUES(:enterpriseId,:userId,:skuId,:quantity,:remark)
      ON DUPLICATE KEY UPDATE default_quantity=:quantity,remark=:remark
      """).param("enterpriseId",enterpriseId()).param("userId",userId()).param("skuId",request.skuId()).param("quantity",request.quantity()).param("remark",request.remark()).update();}

    @PutMapping("/frequent-items/{skuId}")
    void updateFrequent(@PathVariable long skuId,@Valid @RequestBody FrequentRequest request){authorization.require("purchase:manage");int changed=jdbc.sql("UPDATE frequent_purchase_item SET default_quantity=:quantity,remark=:remark WHERE user_id=:userId AND sku_id=:skuId").param("quantity",request.quantity()).param("remark",request.remark()).param("userId",userId()).param("skuId",skuId).update();if(changed==0)throw new IllegalArgumentException("常购商品不存在");}
    @DeleteMapping("/frequent-items/{skuId}") void deleteFrequent(@PathVariable long skuId){authorization.require("purchase:manage");jdbc.sql("DELETE FROM frequent_purchase_item WHERE user_id=:userId AND sku_id=:skuId").params(Map.of("userId",userId(),"skuId",skuId)).update();}

    @PostMapping("/frequent-items/add-to-cart") @Transactional
    Map<String,Object> addFrequentToCart(@RequestBody(required=false) SelectionRequest request){authorization.require("purchase:manage");List<Long> selected=request==null||request.skuIds()==null?List.of():request.skuIds();String condition=selected.isEmpty()?"":" AND f.sku_id IN (:skuIds)";var spec=jdbc.sql("""
      SELECT f.sku_id AS skuId,LEAST(f.default_quantity,s.stock-s.reserved_stock) AS quantity
      FROM frequent_purchase_item f JOIN product_sku s ON s.id=f.sku_id JOIN product_spu p ON p.id=s.spu_id
      WHERE f.user_id=:userId AND s.status=1 AND p.status=1 AND s.deleted_at IS NULL AND p.deleted_at IS NULL AND s.stock-s.reserved_stock>0
      """+condition).param("userId",userId());if(!selected.isEmpty())spec.param("skuIds",selected);return addRowsToCart(spec.query().listOfRows());}

    @PostMapping("/orders/{orderId}/repurchase") @Transactional
    Map<String,Object> repurchase(@PathVariable long orderId){authorization.require("purchase:manage");int owned=jdbc.sql("SELECT COUNT(*) FROM order_main WHERE id=:id AND user_id=:userId").params(Map.of("id",orderId,"userId",userId())).query(Integer.class).single();if(owned==0)throw new IllegalArgumentException("订单不存在或不可复购");var rows=jdbc.sql("""
      SELECT oi.sku_id AS skuId,LEAST(SUM(oi.quantity),s.stock-s.reserved_stock) AS quantity
      FROM order_item oi JOIN product_sku s ON s.id=oi.sku_id JOIN product_spu p ON p.id=s.spu_id
      WHERE oi.order_main_id=:orderId AND oi.fulfillment_status<>4 AND s.status=1 AND p.status=1
        AND s.deleted_at IS NULL AND p.deleted_at IS NULL AND s.stock-s.reserved_stock>0 GROUP BY oi.sku_id
      """).param("orderId",orderId).query().listOfRows();if(rows.isEmpty())throw new IllegalArgumentException("原订单商品均已下架或暂无库存");return addRowsToCart(rows);}

    private Map<String,Object> addRowsToCart(List<Map<String,Object>> rows){int added=0;List<Long> skipped=new ArrayList<>();for(var row:rows){long skuId=((Number)row.get("skuId")).longValue();int quantity=((Number)row.get("quantity")).intValue();if(quantity<1){skipped.add(skuId);continue;}var existing=jdbc.sql("SELECT id FROM cart_item WHERE user_id=:userId AND sku_id=:skuId AND solution_id IS NULL ORDER BY id LIMIT 1").params(Map.of("userId",userId(),"skuId",skuId)).query(Long.class).optional();if(existing.isPresent())jdbc.sql("UPDATE cart_item c JOIN product_sku s ON s.id=c.sku_id SET c.quantity=LEAST(c.quantity+:quantity,s.stock-s.reserved_stock),c.selected=1 WHERE c.id=:id").param("quantity",quantity).param("id",existing.get()).update();else jdbc.sql("INSERT INTO cart_item(user_id,sku_id,quantity,selected) VALUES(:userId,:skuId,:quantity,1)").param("userId",userId()).param("skuId",skuId).param("quantity",quantity).update();added++;}return Map.of("addedKinds",added,"skippedSkuIds",skipped);}
    private void requireSku(long skuId){int count=jdbc.sql("SELECT COUNT(*) FROM product_sku s JOIN product_spu p ON p.id=s.spu_id WHERE s.id=:id AND s.status=1 AND p.status=1 AND s.deleted_at IS NULL AND p.deleted_at IS NULL").param("id",skuId).query(Integer.class).single();if(count==0)throw new IllegalArgumentException("商品不存在或已下架");}
    private long userId(){return auth.current().userId();}private long enterpriseId(){return auth.current().enterpriseId();}
    record FrequentRequest(@NotNull Long skuId,@Min(1) @Max(9999) int quantity,String remark){}record SelectionRequest(List<Long> skuIds){}
}
