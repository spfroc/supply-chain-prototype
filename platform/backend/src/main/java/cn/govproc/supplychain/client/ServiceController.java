package cn.govproc.supplychain.client;

import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.auth.EnterpriseAuthorizationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/client/service")
public class ServiceController {
    private final JdbcClient jdbc;
    private final ClientAuthService auth;
    private final EnterpriseAuthorizationService authorization;

    public ServiceController(JdbcClient jdbc, ClientAuthService auth, EnterpriseAuthorizationService authorization) {
        this.jdbc=jdbc; this.auth=auth; this.authorization=authorization;
    }

    @GetMapping("/after-sales")
    List<Map<String,Object>> afterSales() {
        authorization.require("service:view");
        return jdbc.sql("""
          SELECT a.id,a.service_no AS serviceNo,a.service_type AS serviceType,a.reason,a.requested_quantity AS requestedQuantity,
            a.requested_amount AS requestedAmount,a.status,a.handling_result AS handlingResult,o.order_no AS orderNo,
            p.title,COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,s.sku_code AS skuCode,u.real_name AS applicantName,
            DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,DATE_FORMAT(a.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt
          FROM after_sale_request a JOIN order_main o ON o.id=a.order_main_id JOIN order_item oi ON oi.id=a.order_item_id
          JOIN product_sku s ON s.id=oi.sku_id JOIN product_spu p ON p.id=s.spu_id JOIN enterprise_user u ON u.id=a.applicant_user_id
          WHERE a.enterprise_id=:enterpriseId AND (:enterpriseWide=1 OR a.applicant_user_id=:userId) ORDER BY a.id DESC
          """).param("enterpriseId",enterpriseId()).param("enterpriseWide",enterpriseWide()?1:0).param("userId",userId()).query().listOfRows();
    }

    @GetMapping("/after-sales/eligible-items")
    List<Map<String,Object>> eligibleItems() {
        authorization.require("service:manage");
        return jdbc.sql("""
          SELECT oi.id AS orderItemId,o.id AS orderId,o.order_no AS orderNo,p.title,COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,
            s.sku_code AS skuCode,oi.quantity,oi.unit_price AS unitPrice,oi.total_price AS totalPrice,
            DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM order_item oi JOIN order_main o ON o.id=oi.order_main_id JOIN product_sku s ON s.id=oi.sku_id JOIN product_spu p ON p.id=s.spu_id
          WHERE o.enterprise_id=:enterpriseId AND (:enterpriseWide=1 OR o.user_id=:userId) AND oi.fulfillment_status=3
            AND NOT EXISTS(SELECT 1 FROM after_sale_request a WHERE a.order_item_id=oi.id AND a.status NOT IN (4,5,6))
          ORDER BY oi.id DESC
          """).param("enterpriseId",enterpriseId()).param("enterpriseWide",enterpriseWide()?1:0).param("userId",userId()).query().listOfRows();
    }

    @GetMapping("/after-sales/{id}")
    Map<String,Object> afterSale(@PathVariable long id) {
        authorization.require("service:view"); requireAfterSale(id);
        var request=jdbc.sql("""
          SELECT a.*,o.order_no AS orderNo,p.title,s.sku_code AS skuCode,COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,
            u.real_name AS applicantName FROM after_sale_request a JOIN order_main o ON o.id=a.order_main_id
          JOIN order_item oi ON oi.id=a.order_item_id JOIN product_sku s ON s.id=oi.sku_id JOIN product_spu p ON p.id=s.spu_id
          JOIN enterprise_user u ON u.id=a.applicant_user_id WHERE a.id=:id
          """).param("id",id).query().singleRow();
        var timeline=jdbc.sql("SELECT operator_type AS operatorType,action,content,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS createdAt FROM after_sale_timeline WHERE request_id=:id ORDER BY id")
          .param("id",id).query().listOfRows();
        return Map.of("request",request,"timeline",timeline);
    }

    @PostMapping("/after-sales") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String,Object> createAfterSale(@Valid @RequestBody AfterSaleRequest request) {
        authorization.require("service:manage");
        var items=jdbc.sql("""
          SELECT oi.id,oi.order_main_id AS orderId,oi.quantity,oi.total_price AS totalPrice,o.user_id AS buyerId
          FROM order_item oi JOIN order_main o ON o.id=oi.order_main_id
          WHERE oi.id=:itemId AND o.enterprise_id=:enterpriseId AND oi.fulfillment_status=3
          """).param("itemId",request.orderItemId()).param("enterpriseId",enterpriseId()).query().listOfRows();
        if(items.isEmpty()||(!enterpriseWide()&&((Number)items.getFirst().get("buyerId")).longValue()!=userId())) throw new IllegalArgumentException("订单商品不存在或尚未签收");
        var item=items.getFirst(); int ordered=((Number)item.get("quantity")).intValue();
        if(request.requestedQuantity()>ordered)throw new IllegalArgumentException("售后数量不能超过购买数量");
        int active=jdbc.sql("SELECT COUNT(*) FROM after_sale_request WHERE order_item_id=:id AND status NOT IN (4,5,6)").param("id",request.orderItemId()).query(Integer.class).single();
        if(active>0)throw new IllegalArgumentException("该商品已有处理中售后申请");
        BigDecimal max=((BigDecimal)item.get("totalPrice")).multiply(BigDecimal.valueOf(request.requestedQuantity())).divide(BigDecimal.valueOf(ordered),2,java.math.RoundingMode.HALF_UP);
        if(request.requestedAmount()!=null&&request.requestedAmount().compareTo(max)>0)throw new IllegalArgumentException("申请金额不能超过对应商品金额");
        String no="SH"+LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))+ThreadLocalRandom.current().nextInt(1000,10000);
        jdbc.sql("""
          INSERT INTO after_sale_request(service_no,enterprise_id,applicant_user_id,order_main_id,order_item_id,service_type,reason,description,
            requested_quantity,requested_amount,contact_name,contact_phone,evidence_json)
          VALUES(:no,:enterpriseId,:userId,:orderId,:itemId,:type,:reason,:description,:quantity,:amount,:contactName,:contactPhone,JSON_ARRAY())
          """).param("no",no).param("enterpriseId",enterpriseId()).param("userId",userId()).param("orderId",item.get("orderId"))
          .param("itemId",request.orderItemId()).param("type",request.serviceType()).param("reason",request.reason().trim())
          .param("description",request.description()).param("quantity",request.requestedQuantity()).param("amount",request.requestedAmount())
          .param("contactName",request.contactName().trim()).param("contactPhone",request.contactPhone().trim()).update();
        long id=jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single(); addTimeline(id,"CLIENT","SUBMITTED","客户提交售后申请");
        return Map.of("id",id,"serviceNo",no);
    }

    @PostMapping("/after-sales/{id}/cancel") @Transactional
    void cancel(@PathVariable long id) { authorization.require("service:manage"); requireAfterSale(id);
        int changed=jdbc.sql("UPDATE after_sale_request SET status=6 WHERE id=:id AND applicant_user_id=:userId AND status=0").params(Map.of("id",id,"userId",userId())).update();
        if(changed==0)throw new IllegalArgumentException("当前售后申请不可取消"); addTimeline(id,"CLIENT","CANCELLED","客户取消售后申请"); }

    @PutMapping("/after-sales/{id}/return-logistics") @Transactional
    void returnLogistics(@PathVariable long id,@Valid @RequestBody ReturnLogisticsRequest request) { authorization.require("service:manage"); requireAfterSale(id);
        int changed=jdbc.sql("UPDATE after_sale_request SET return_logistics_company=:company,return_logistics_no=:no,status=3 WHERE id=:id AND status=2")
          .param("company",request.logisticsCompany().trim()).param("no",request.logisticsNo().trim()).param("id",id).update();
        if(changed==0)throw new IllegalArgumentException("当前售后状态无需填写寄回物流"); addTimeline(id,"CLIENT","RETURN_SHIPPED",request.logisticsCompany()+" "+request.logisticsNo()); }

    @PostMapping("/orders/{orderId}/deliveries/{subOrderNo}/confirm-receipt") @Transactional
    void confirmReceipt(@PathVariable long orderId,@PathVariable String subOrderNo) {
        authorization.require("service:manage");
        int owned=jdbc.sql("SELECT COUNT(*) FROM order_main WHERE id=:id AND enterprise_id=:enterpriseId AND (:enterpriseWide=1 OR user_id=:userId)")
          .param("id",orderId).param("enterpriseId",enterpriseId()).param("enterpriseWide",enterpriseWide()?1:0).param("userId",userId()).query(Integer.class).single();
        if(owned==0)throw new IllegalArgumentException("订单不存在");
        int changed=jdbc.sql("UPDATE order_item oi JOIN order_sub os ON os.id=oi.order_sub_id SET oi.fulfillment_status=3,oi.logistics_status='已签收' WHERE os.order_main_id=:orderId AND os.sub_order_no=:subNo AND oi.fulfillment_status IN (1,2)")
          .params(Map.of("orderId",orderId,"subNo",subOrderNo)).update();
        if(changed==0)throw new IllegalArgumentException("配送单尚未发货或已经签收");
        jdbc.sql("UPDATE order_sub SET status=3,signed_at=NOW(),logistics_status='已签收' WHERE order_main_id=:orderId AND sub_order_no=:subNo")
          .params(Map.of("orderId",orderId,"subNo",subOrderNo)).update();
        int pending=jdbc.sql("SELECT COUNT(*) FROM order_item WHERE order_main_id=:id AND fulfillment_status NOT IN (3,4)").param("id",orderId).query(Integer.class).single();
        if(pending==0)jdbc.sql("UPDATE order_main SET order_status=3 WHERE id=:id AND order_status IN (1,2)").param("id",orderId).update();
    }

    @GetMapping("/stock-subscriptions") List<Map<String,Object>> subscriptions() { authorization.require("service:view"); return jdbc.sql("""
      SELECT a.id,a.sku_id AS skuId,a.status,p.title,s.sku_code AS skuCode,s.stock-s.reserved_stock AS availableStock,
        COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
      FROM stock_arrival_subscription a JOIN product_sku s ON s.id=a.sku_id JOIN product_spu p ON p.id=s.spu_id
      WHERE a.user_id=:userId AND a.status<>0 ORDER BY a.id DESC
      """).param("userId",userId()).query().listOfRows(); }

    @PostMapping("/stock-subscriptions/{skuId}") @ResponseStatus(HttpStatus.CREATED)
    void subscribe(@PathVariable long skuId) { authorization.require("service:manage"); int exists=jdbc.sql("SELECT COUNT(*) FROM product_sku WHERE id=:id AND status=1 AND deleted_at IS NULL").param("id",skuId).query(Integer.class).single(); if(exists==0)throw new IllegalArgumentException("SKU不存在或已停用");
      jdbc.sql("INSERT INTO stock_arrival_subscription(enterprise_id,user_id,sku_id,status) VALUES(:enterpriseId,:userId,:skuId,1) ON DUPLICATE KEY UPDATE status=1,notified_at=NULL")
        .param("enterpriseId",enterpriseId()).param("userId",userId()).param("skuId",skuId).update(); }

    @DeleteMapping("/stock-subscriptions/{skuId}") void unsubscribe(@PathVariable long skuId) { authorization.require("service:manage"); jdbc.sql("UPDATE stock_arrival_subscription SET status=0 WHERE user_id=:userId AND sku_id=:skuId").params(Map.of("userId",userId(),"skuId",skuId)).update(); }

    private void requireAfterSale(long id) { int count=jdbc.sql("SELECT COUNT(*) FROM after_sale_request WHERE id=:id AND enterprise_id=:enterpriseId AND (:enterpriseWide=1 OR applicant_user_id=:userId)")
      .param("id",id).param("enterpriseId",enterpriseId()).param("enterpriseWide",enterpriseWide()?1:0).param("userId",userId()).query(Integer.class).single(); if(count==0)throw new IllegalArgumentException("售后申请不存在"); }
    private void addTimeline(long id,String type,String action,String content) { jdbc.sql("INSERT INTO after_sale_timeline(request_id,operator_type,operator_id,action,content) VALUES(:id,:type,:userId,:action,:content)")
      .param("id",id).param("type",type).param("userId",userId()).param("action",action).param("content",content).update(); }
    private boolean enterpriseWide(){return "ENTERPRISE_ADMIN".equals(auth.current().roleCode());}
    private long userId(){return auth.current().userId();} private long enterpriseId(){return auth.current().enterpriseId();}

    record AfterSaleRequest(@NotNull Long orderItemId,@NotBlank String serviceType,@NotBlank String reason,String description,
      @Min(1) int requestedQuantity,BigDecimal requestedAmount,@NotBlank String contactName,@NotBlank String contactPhone){}
    record ReturnLogisticsRequest(@NotBlank String logisticsCompany,@NotBlank String logisticsNo){}
}
