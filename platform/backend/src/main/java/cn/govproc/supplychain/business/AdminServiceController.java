package cn.govproc.supplychain.business;

import cn.govproc.supplychain.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/business/after-sales")
public class AdminServiceController {
    private final JdbcClient jdbc;
    private final NotificationService notifications;
    public AdminServiceController(JdbcClient jdbc,NotificationService notifications){this.jdbc=jdbc;this.notifications=notifications;}

    @GetMapping
    List<Map<String,Object>> list(@RequestParam(required=false) Integer status,@RequestParam(required=false) String keyword){
        String where=" WHERE 1=1"; var params=new java.util.HashMap<String,Object>();
        if(status!=null){where+=" AND a.status=:status";params.put("status",status);}
        if(keyword!=null&&!keyword.isBlank()){where+=" AND (a.service_no LIKE :keyword OR o.order_no LIKE :keyword OR e.name LIKE :keyword OR p.title LIKE :keyword OR u.real_name LIKE :keyword)";params.put("keyword","%"+keyword.trim()+"%");}
        return jdbc.sql("""
          SELECT a.id,a.service_no AS serviceNo,a.service_type AS serviceType,a.reason,a.requested_quantity AS requestedQuantity,
            a.requested_amount AS requestedAmount,a.status,a.handling_result AS handlingResult,a.contact_name AS contactName,
            a.contact_phone AS contactPhone,o.order_no AS orderNo,e.name AS enterpriseName,u.real_name AS applicantName,
            p.title,COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,s.sku_code AS skuCode,
            DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,DATE_FORMAT(a.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt
          FROM after_sale_request a JOIN order_main o ON o.id=a.order_main_id JOIN enterprise e ON e.id=a.enterprise_id
          JOIN enterprise_user u ON u.id=a.applicant_user_id JOIN order_item oi ON oi.id=a.order_item_id
          JOIN product_sku s ON s.id=oi.sku_id JOIN product_spu p ON p.id=s.spu_id
          """+where+" ORDER BY a.id DESC").params(params).query().listOfRows();
    }

    @GetMapping("/{id}")
    Map<String,Object> detail(@PathVariable long id){
        var rows=jdbc.sql("""
          SELECT a.*,o.order_no AS orderNo,e.name AS enterpriseName,u.real_name AS applicantName,p.title,s.sku_code AS skuCode,
            COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,oi.quantity AS orderedQuantity,oi.total_price AS itemAmount
          FROM after_sale_request a JOIN order_main o ON o.id=a.order_main_id JOIN enterprise e ON e.id=a.enterprise_id
          JOIN enterprise_user u ON u.id=a.applicant_user_id JOIN order_item oi ON oi.id=a.order_item_id
          JOIN product_sku s ON s.id=oi.sku_id JOIN product_spu p ON p.id=s.spu_id WHERE a.id=:id
          """).param("id",id).query().listOfRows();
        if(rows.isEmpty())throw new IllegalArgumentException("售后申请不存在");
        var timeline=jdbc.sql("SELECT operator_type AS operatorType,action,content,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS createdAt FROM after_sale_timeline WHERE request_id=:id ORDER BY id")
          .param("id",id).query().listOfRows();
        return Map.of("request",rows.getFirst(),"timeline",timeline);
    }

    @PutMapping("/{id}/status") @Transactional
    void update(@PathVariable long id,@Valid @RequestBody StatusRequest request){
        if(request.status()<1||request.status()>5)throw new IllegalArgumentException("售后状态不正确");
        if((request.status()==4||request.status()==5)&&request.handlingResult().isBlank())throw new IllegalArgumentException("完成或驳回时必须填写处理结果");
        var targets=jdbc.sql("SELECT enterprise_id AS enterpriseId,applicant_user_id AS userId,service_no AS serviceNo FROM after_sale_request WHERE id=:id").param("id",id).query().listOfRows();
        if(targets.isEmpty())throw new IllegalArgumentException("售后申请不存在");
        int changed=jdbc.sql("UPDATE after_sale_request SET status=:status,handling_result=:result,processed_at=CASE WHEN :status IN (4,5) THEN NOW() ELSE processed_at END WHERE id=:id AND status<>6")
          .param("status",request.status()).param("result",request.handlingResult().trim()).param("id",id).update();
        if(changed==0)throw new IllegalArgumentException("售后申请不存在或已取消");
        jdbc.sql("INSERT INTO after_sale_timeline(request_id,operator_type,action,content) VALUES(:id,'ADMIN','STATUS_CHANGED',:content)")
          .param("id",id).param("content",request.handlingResult().trim()).update();
        var target=targets.getFirst();notifications.send(((Number)target.get("enterpriseId")).longValue(),((Number)target.get("userId")).longValue(),"AFTER_SALE","售后进度已更新",
          target.get("serviceNo")+"："+request.handlingResult().trim(),"/web/account/after-sales","AFTER_SALE",id,"after-sale-"+id+"-status-"+request.status());
    }

    record StatusRequest(@NotNull Integer status,@NotBlank String handlingResult){}
}
