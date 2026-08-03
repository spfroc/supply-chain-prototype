package cn.govproc.supplychain.business;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/business")
public class AdminBusinessController {
    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    public AdminBusinessController(JdbcClient jdbc,PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    @GetMapping("/products")
    List<Map<String,Object>> products() {
        return jdbc.sql("""
          SELECT p.id,p.spu_code AS spuCode,p.title,p.summary,p.main_image AS mainImage,
            JSON_UNQUOTE(JSON_EXTRACT(p.gallery_json,'$.content')) AS gallery,
            JSON_UNQUOTE(JSON_EXTRACT(p.attributes_json,'$.content')) AS attributes,
            p.detail_html AS detailHtml,p.delivery_description AS deliveryDescription,
            p.after_sales_html AS afterSalesHtml,p.category_id AS categoryId,p.brand_id AS brandId,
            p.status,s.id AS skuId,s.sku_code AS skuCode,s.market_price AS marketPrice,s.member_price AS memberPrice,
            s.stock,s.reserved_stock AS reservedStock,DATE_FORMAT(p.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt
          FROM product_spu p JOIN product_sku s ON s.spu_id=p.id AND s.deleted_at IS NULL
          WHERE p.deleted_at IS NULL ORDER BY p.id DESC
          """).query().listOfRows();
    }

    @PostMapping("/products") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Map<String,Object> createProduct(@Valid @RequestBody ProductRequest r) {
        String suffix=LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
          +"-"+UUID.randomUUID().toString().substring(0,8);
        String spuCode="SPU-"+suffix, skuCode="SKU-"+suffix;
        jdbc.sql("""
          INSERT INTO product_spu(spu_code,title,category_id,brand_id,main_image,gallery_json,attributes_json,
            summary,detail_html,delivery_description,after_sales_html,status)
          VALUES(:code,:title,:categoryId,:brandId,:mainImage,JSON_OBJECT('content',:gallery),
            JSON_OBJECT('content',:attributes),:summary,:detailHtml,:deliveryDescription,:afterSalesHtml,:status)
          """)
          .param("code",spuCode).param("title",r.title()).param("categoryId",r.categoryId()).param("brandId",r.brandId())
          .param("mainImage",value(r.mainImage())).param("gallery",value(r.gallery())).param("attributes",value(r.attributes()))
          .param("summary",value(r.summary())).param("detailHtml",value(r.detailHtml()))
          .param("deliveryDescription",value(r.deliveryDescription())).param("afterSalesHtml",value(r.afterSalesHtml()))
          .param("status",r.status()).update();
        long id=jdbc.sql("SELECT id FROM product_spu WHERE spu_code=:code").param("code",spuCode).query(Long.class).single();
        jdbc.sql("""
          INSERT INTO product_sku(spu_id,sku_code,spec_json,market_price,member_price,stock,status)
          VALUES(:spuId,:skuCode,JSON_OBJECT('规格',:spec),:marketPrice,:memberPrice,:stock,:status)
          """)
          .params(Map.of("spuId",id,"skuCode",skuCode,"spec",value(r.spec()),"marketPrice",r.marketPrice(),
            "memberPrice",r.memberPrice(),"stock",r.stock(),"status",r.status()==1?1:0)).update();
        return Map.of("id",id,"spuCode",spuCode);
    }

    @PutMapping("/products/{id}") @Transactional
    void updateProduct(@PathVariable long id,@Valid @RequestBody ProductRequest r) {
        require(jdbc.sql("""
          UPDATE product_spu SET title=:title,category_id=:categoryId,brand_id=:brandId,
          main_image=:mainImage,gallery_json=JSON_OBJECT('content',:gallery),
          attributes_json=JSON_OBJECT('content',:attributes),summary=:summary,detail_html=:detailHtml,
          delivery_description=:deliveryDescription,after_sales_html=:afterSalesHtml,
          status=:status WHERE id=:id AND deleted_at IS NULL
          """)
          .param("id",id).param("title",r.title()).param("categoryId",r.categoryId()).param("brandId",r.brandId())
          .param("mainImage",value(r.mainImage())).param("gallery",value(r.gallery()))
          .param("attributes",value(r.attributes())).param("summary",value(r.summary()))
          .param("detailHtml",value(r.detailHtml())).param("deliveryDescription",value(r.deliveryDescription()))
          .param("afterSalesHtml",value(r.afterSalesHtml())).param("status",r.status()).update(),"商品不存在");
        jdbc.sql("""
          UPDATE product_sku SET spec_json=JSON_OBJECT('规格',:spec),market_price=:marketPrice,
          member_price=:memberPrice,stock=:stock,status=:status WHERE spu_id=:id AND deleted_at IS NULL
          """)
          .params(Map.of("id",id,"spec",value(r.spec()),"marketPrice",r.marketPrice(),"memberPrice",r.memberPrice(),
            "stock",r.stock(),"status",r.status()==1?1:0)).update();
    }

    @PutMapping("/products/{id}/status") @Transactional
    void productStatus(@PathVariable long id,@RequestBody StatusRequest r) {
        require(jdbc.sql("UPDATE product_spu SET status=:status WHERE id=:id AND deleted_at IS NULL")
          .params(Map.of("id",id,"status",r.status())).update(),"商品不存在");
        jdbc.sql("UPDATE product_sku SET status=:status WHERE spu_id=:id AND deleted_at IS NULL")
          .params(Map.of("id",id,"status",r.status()==1?1:0)).update();
    }

    @PutMapping("/products/{id}/stock") @Transactional
    void productStock(@PathVariable long id,@RequestBody StockRequest r) {
        int reserved=jdbc.sql("SELECT reserved_stock FROM product_sku WHERE spu_id=:id AND deleted_at IS NULL")
          .param("id",id).query(Integer.class).optional().orElseThrow(()->new IllegalArgumentException("商品不存在"));
        if(r.stock()<reserved) throw new IllegalArgumentException("库存不能小于已占用库存 "+reserved);
        jdbc.sql("UPDATE product_sku SET stock=:stock WHERE spu_id=:id AND deleted_at IS NULL")
          .params(Map.of("id",id,"stock",r.stock())).update();
    }

    @DeleteMapping("/products/{id}") @Transactional @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteProduct(@PathVariable long id) {
        require(jdbc.sql("UPDATE product_spu SET deleted_at=NOW(),status=2 WHERE id=:id AND deleted_at IS NULL")
          .param("id",id).update(),"商品不存在");
        jdbc.sql("UPDATE product_sku SET deleted_at=NOW(),status=0 WHERE spu_id=:id AND deleted_at IS NULL").param("id",id).update();
    }

    @GetMapping("/categories")
    List<Map<String,Object>> categories() {
        return jdbc.sql("""
          SELECT c.id,c.name,c.parent_id AS parentId,p.name AS parentName,c.level,c.sort_order AS sortOrder,
            c.icon,c.status,COUNT(DISTINCT child.id) AS childCount,COUNT(DISTINCT product.id) AS productCount
          FROM category c LEFT JOIN category p ON p.id=c.parent_id
          LEFT JOIN category child ON child.parent_id=c.id AND child.deleted_at IS NULL
          LEFT JOIN product_spu product ON product.category_id=c.id AND product.deleted_at IS NULL
          WHERE c.deleted_at IS NULL GROUP BY c.id ORDER BY c.level,c.sort_order,c.id
          """).query().listOfRows();
    }

    @PostMapping("/categories") @ResponseStatus(HttpStatus.CREATED)
    void createCategory(@Valid @RequestBody CategoryRequest r) {
        validateCategoryParent(null,r.parentId(),r.level());
        jdbc.sql("""
          INSERT INTO category(name,parent_id,level,sort_order,icon,status)
          VALUES(:name,:parentId,:level,:sortOrder,:icon,:status)
          """).param("name",r.name()).param("parentId",r.parentId()).param("level",r.level())
          .param("sortOrder",r.sortOrder()).param("icon",value(r.icon())).param("status",r.status()).update();
    }

    @PutMapping("/categories/{id}")
    void updateCategory(@PathVariable long id,@Valid @RequestBody CategoryRequest r) {
        validateCategoryParent(id,r.parentId(),r.level());
        require(jdbc.sql("""
          UPDATE category SET name=:name,parent_id=:parentId,level=:level,sort_order=:sortOrder,
            icon=:icon,status=:status WHERE id=:id AND deleted_at IS NULL
          """).param("id",id).param("name",r.name()).param("parentId",r.parentId()).param("level",r.level())
          .param("sortOrder",r.sortOrder()).param("icon",value(r.icon())).param("status",r.status()).update(),
          "分类不存在");
    }

    @DeleteMapping("/categories/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteCategory(@PathVariable long id) {
        long children=jdbc.sql("SELECT COUNT(*) FROM category WHERE parent_id=:id AND deleted_at IS NULL")
          .param("id",id).query(Long.class).single();
        long products=jdbc.sql("SELECT COUNT(*) FROM product_spu WHERE category_id=:id AND deleted_at IS NULL")
          .param("id",id).query(Long.class).single();
        if(children>0) throw new IllegalArgumentException("分类下存在子分类，不能删除");
        if(products>0) throw new IllegalArgumentException("分类已关联商品，不能删除");
        require(jdbc.sql("UPDATE category SET deleted_at=NOW(),status=0 WHERE id=:id AND deleted_at IS NULL")
          .param("id",id).update(),"分类不存在");
    }

    @GetMapping("/enterprises")
    List<Map<String,Object>> enterprises() {
        return jdbc.sql("""
          SELECT e.id,e.name,e.credit_code AS creditCode,e.contact_name AS contactName,e.contact_phone AS contactPhone,
            e.address,e.status,COUNT(DISTINCT u.id) AS memberCount,MAX(a.name) AS agreementName,
            DATE_FORMAT(e.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM enterprise e LEFT JOIN enterprise_user u ON u.enterprise_id=e.id AND u.deleted_at IS NULL
          LEFT JOIN agreement a ON a.enterprise_id=e.id AND a.status=1 AND a.deleted_at IS NULL
          WHERE e.deleted_at IS NULL GROUP BY e.id ORDER BY e.id DESC
          """).query().listOfRows();
    }

    @PostMapping("/enterprises") @ResponseStatus(HttpStatus.CREATED)
    void createEnterprise(@Valid @RequestBody EnterpriseRequest r) {
        jdbc.sql("""
          INSERT INTO enterprise(name,credit_code,contact_name,contact_phone,address,audit_status,status)
          VALUES(:name,:creditCode,:contactName,:contactPhone,:address,2,:status)
          """)
          .params(Map.of("name",r.name(),"creditCode",r.creditCode(),"contactName",r.contactName(),
            "contactPhone",r.contactPhone(),"address",value(r.address()),"status",r.status())).update();
    }

    @PutMapping("/enterprises/{id}")
    void updateEnterprise(@PathVariable long id,@Valid @RequestBody EnterpriseRequest r) {
        require(jdbc.sql("""
          UPDATE enterprise SET name=:name,credit_code=:creditCode,contact_name=:contactName,
          contact_phone=:contactPhone,address=:address,status=:status WHERE id=:id AND deleted_at IS NULL
          """)
          .params(Map.of("id",id,"name",r.name(),"creditCode",r.creditCode(),"contactName",r.contactName(),
            "contactPhone",r.contactPhone(),"address",value(r.address()),"status",r.status())).update(),"企业不存在");
    }

    @DeleteMapping("/enterprises/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteEnterprise(@PathVariable long id) {
        long orders=jdbc.sql("SELECT COUNT(*) FROM order_main WHERE enterprise_id=:id").param("id",id).query(Long.class).single();
        if(orders>0) throw new IllegalArgumentException("企业已有订单，只能停用，不能删除");
        require(jdbc.sql("UPDATE enterprise SET deleted_at=NOW(),status=0 WHERE id=:id AND deleted_at IS NULL")
          .param("id",id).update(),"企业不存在");
    }

    @GetMapping("/enterprises/{enterpriseId}/members")
    List<Map<String,Object>> enterpriseMembers(@PathVariable long enterpriseId) {
        return jdbc.sql("""
          SELECT id,username,real_name AS realName,phone,role_code AS roleCode,status,
            DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM enterprise_user
          WHERE enterprise_id=:enterpriseId AND deleted_at IS NULL ORDER BY id
          """).param("enterpriseId",enterpriseId).query().listOfRows();
    }

    @PostMapping("/enterprises/{enterpriseId}/members") @ResponseStatus(HttpStatus.CREATED)
    void createEnterpriseMember(@PathVariable long enterpriseId,@Valid @RequestBody EnterpriseMemberRequest r) {
        validatePassword(r.password(),true);
        require(jdbc.sql("SELECT COUNT(*) FROM enterprise WHERE id=:id AND deleted_at IS NULL")
          .param("id",enterpriseId).query(Integer.class).single(),"企业不存在");
        jdbc.sql("""
          INSERT INTO enterprise_user(enterprise_id,username,password_hash,real_name,phone,role_code,status)
          VALUES(:enterpriseId,:username,:password,:realName,:phone,:roleCode,:status)
          """).params(Map.of("enterpriseId",enterpriseId,"username",r.username(),"realName",r.realName(),
          "password",encoder.encode(r.password()),"phone",r.phone(),"roleCode",r.roleCode(),"status",r.status())).update();
    }

    @PutMapping("/enterprises/{enterpriseId}/members/{memberId}") @Transactional
    void updateEnterpriseMember(@PathVariable long enterpriseId,@PathVariable long memberId,
                                @Valid @RequestBody EnterpriseMemberRequest r) {
        validatePassword(r.password(),false);
        require(jdbc.sql("""
          UPDATE enterprise_user SET username=:username,real_name=:realName,phone=:phone,
            role_code=:roleCode,status=:status
          WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
          """).params(Map.of("enterpriseId",enterpriseId,"memberId",memberId,"username",r.username(),
          "realName",r.realName(),"phone",r.phone(),"roleCode",r.roleCode(),"status",r.status())).update(),
          "企业成员不存在");
        if(r.password()!=null&&!r.password().isBlank()) {
            jdbc.sql("""
              UPDATE enterprise_user SET password_hash=:password
              WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
              """).params(Map.of("enterpriseId",enterpriseId,"memberId",memberId,
              "password",encoder.encode(r.password()))).update();
        }
    }

    @DeleteMapping("/enterprises/{enterpriseId}/members/{memberId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteEnterpriseMember(@PathVariable long enterpriseId,@PathVariable long memberId) {
        var found=jdbc.sql("""
          SELECT role_code AS roleCode FROM enterprise_user
          WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
          """).params(Map.of("enterpriseId",enterpriseId,"memberId",memberId)).query().listOfRows();
        if(found.isEmpty()) throw new IllegalArgumentException("企业成员不存在");
        var member=found.getFirst();
        if("ENTERPRISE_ADMIN".equals(member.get("roleCode"))) {
            long admins=jdbc.sql("""
              SELECT COUNT(*) FROM enterprise_user
              WHERE enterprise_id=:enterpriseId AND role_code='ENTERPRISE_ADMIN' AND deleted_at IS NULL
              """).param("enterpriseId",enterpriseId).query(Long.class).single();
            if(admins<=1) throw new IllegalArgumentException("企业至少需要保留一名管理员");
        }
        require(jdbc.sql("""
          UPDATE enterprise_user SET deleted_at=NOW(),status=0
          WHERE id=:memberId AND enterprise_id=:enterpriseId AND deleted_at IS NULL
          """).params(Map.of("enterpriseId",enterpriseId,"memberId",memberId)).update(),"企业成员不存在");
    }

    @GetMapping("/agreements")
    List<Map<String,Object>> agreements() {
        return jdbc.sql("""
          SELECT a.id,a.agreement_no AS agreementNo,a.name,a.enterprise_id AS enterpriseId,e.name AS enterpriseName,
            a.amount,DATE_FORMAT(a.effective_date,'%Y-%m-%d') AS effectiveDate,
            DATE_FORMAT(a.expiry_date,'%Y-%m-%d') AS expiryDate,a.status,COUNT(ai.id) AS itemCount
          FROM agreement a JOIN enterprise e ON e.id=a.enterprise_id
          LEFT JOIN agreement_item ai ON ai.agreement_id=a.id AND ai.deleted_at IS NULL
          WHERE a.deleted_at IS NULL GROUP BY a.id ORDER BY a.id DESC
          """).query().listOfRows();
    }

    @PostMapping("/agreements") @ResponseStatus(HttpStatus.CREATED) @Transactional
    void createAgreement(@Valid @RequestBody AgreementRequest r) {
        if(r.status()==1) jdbc.sql("UPDATE agreement SET status=2 WHERE enterprise_id=:id AND status=1 AND deleted_at IS NULL")
          .param("id",r.enterpriseId()).update();
        String no="AGR-"+LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
          +"-"+UUID.randomUUID().toString().substring(0,8);
        jdbc.sql("""
          INSERT INTO agreement(agreement_no,enterprise_id,name,amount,effective_date,expiry_date,status)
          VALUES(:no,:enterpriseId,:name,:amount,:effectiveDate,:expiryDate,:status)
          """)
          .params(Map.of("no",no,"enterpriseId",r.enterpriseId(),"name",r.name(),"amount",r.amount(),
            "effectiveDate",r.effectiveDate(),"expiryDate",r.expiryDate(),"status",r.status())).update();
    }

    @PutMapping("/agreements/{id}") @Transactional
    void updateAgreement(@PathVariable long id,@Valid @RequestBody AgreementRequest r) {
        if(r.status()==1) jdbc.sql("UPDATE agreement SET status=2 WHERE enterprise_id=:enterpriseId AND status=1 AND id<>:id AND deleted_at IS NULL")
          .params(Map.of("enterpriseId",r.enterpriseId(),"id",id)).update();
        require(jdbc.sql("""
          UPDATE agreement SET enterprise_id=:enterpriseId,name=:name,amount=:amount,
          effective_date=:effectiveDate,expiry_date=:expiryDate,status=:status WHERE id=:id AND deleted_at IS NULL
          """)
          .params(Map.of("id",id,"enterpriseId",r.enterpriseId(),"name",r.name(),"amount",r.amount(),
            "effectiveDate",r.effectiveDate(),"expiryDate",r.expiryDate(),"status",r.status())).update(),"协议不存在");
    }

    @DeleteMapping("/agreements/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteAgreement(@PathVariable long id) {
        long orders=jdbc.sql("SELECT COUNT(*) FROM order_main WHERE agreement_id=:id").param("id",id).query(Long.class).single();
        if(orders>0) throw new IllegalArgumentException("协议已有订单引用，只能停用，不能删除");
        require(jdbc.sql("UPDATE agreement SET deleted_at=NOW(),status=2 WHERE id=:id AND deleted_at IS NULL")
          .param("id",id).update(),"协议不存在");
    }

    @GetMapping("/orders")
    List<Map<String,Object>> orders() {
        return jdbc.sql("""
          SELECT o.id,o.order_no AS orderNo,e.name AS enterpriseName,o.payable_amount AS payableAmount,
            o.payment_status AS paymentStatus,o.order_status AS orderStatus,o.refund_status AS refundStatus,
            o.refund_amount AS refundAmount,
            DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,COUNT(oi.id) AS itemKinds,SUM(oi.quantity) AS itemCount
          FROM order_main o JOIN enterprise e ON e.id=o.enterprise_id LEFT JOIN order_item oi ON oi.order_main_id=o.id
          GROUP BY o.id ORDER BY o.id DESC
          """).query().listOfRows();
    }

    @GetMapping("/orders/{id}")
    Map<String,Object> order(@PathVariable long id) {
        var order=jdbc.sql("""
          SELECT o.id,o.order_no AS orderNo,e.name AS enterpriseName,u.real_name AS buyerName,
            o.item_amount AS itemAmount,o.freight_amount AS freightAmount,o.payable_amount AS payableAmount,
            o.payment_status AS paymentStatus,o.order_status AS orderStatus,o.refund_status AS refundStatus,
            o.refund_amount AS refundAmount,o.refund_reason AS refundReason,
            DATE_FORMAT(o.refunded_at,'%Y-%m-%d %H:%i:%s') AS refundedAt,
            DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM order_main o JOIN enterprise e ON e.id=o.enterprise_id JOIN enterprise_user u ON u.id=o.user_id WHERE o.id=:id
          """)
          .param("id",id).query().singleRow();
        var items=jdbc.sql("""
          SELECT oi.id,p.title,p.main_image AS mainImage,s.sku_code AS skuCode,
            os.sub_order_no AS subOrderNo,os.address_snapshot AS addressSnapshot,
            oi.quantity,oi.unit_price AS unitPrice,oi.total_price AS totalPrice,
            oi.fulfillment_status AS fulfillmentStatus,oi.logistics_company AS logisticsCompany,
            oi.logistics_no AS logisticsNo,oi.logistics_status AS logisticsStatus,
            DATE_FORMAT(oi.shipped_at,'%Y-%m-%d %H:%i:%s') AS shippedAt
          FROM order_item oi JOIN product_sku s ON s.id=oi.sku_id
          JOIN product_spu p ON p.id=s.spu_id JOIN order_sub os ON os.id=oi.order_sub_id
          WHERE oi.order_main_id=:id
          """).param("id",id).query().listOfRows();
        var timeline=jdbc.sql("""
          SELECT event_type AS eventType,from_status AS fromStatus,to_status AS toStatus,
            description,operator_type AS operatorType,
            DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
          FROM order_event WHERE order_main_id=:id ORDER BY id DESC
          """).param("id",id).query().listOfRows();
        return Map.of("order",order,"items",items,"timeline",timeline);
    }

    @PutMapping("/orders/{orderId}/items/{itemId}/logistics")
    @Transactional
    void itemLogistics(@PathVariable long orderId,@PathVariable long itemId,
                       @RequestBody ItemLogisticsRequest r) {
        List<Map<String,Object>> orders=jdbc.sql("""
          SELECT order_status AS orderStatus,refund_status AS refundStatus
          FROM order_main WHERE id=:id
          """).param("id",orderId).query().listOfRows();
        if(orders.isEmpty()) throw new IllegalArgumentException("订单不存在");
        int currentOrderStatus=((Number)orders.getFirst().get("orderStatus")).intValue();
        int refundStatus=((Number)orders.getFirst().get("refundStatus")).intValue();
        if(currentOrderStatus==3||currentOrderStatus==4||refundStatus!=0)
            throw new IllegalArgumentException("已完成、已取消或已退款订单不能修改物流信息");
        if(r.fulfillmentStatus()<0||r.fulfillmentStatus()>4)
            throw new IllegalArgumentException("商品发货状态无效");
        if(r.fulfillmentStatus()>0&&(value(r.logisticsCompany()).isBlank()||value(r.logisticsNo()).isBlank()))
            throw new IllegalArgumentException("已发货商品必须填写物流公司和运单号");
        Integer currentItemStatus=jdbc.sql("""
          SELECT fulfillment_status FROM order_item WHERE id=:itemId AND order_main_id=:orderId
          """).params(Map.of("itemId",itemId,"orderId",orderId)).query(Integer.class).single();
        if(r.fulfillmentStatus()<currentItemStatus)
            throw new IllegalArgumentException("商品物流状态不能倒退");
        if(r.fulfillmentStatus()==4&&currentItemStatus!=0)
            throw new IllegalArgumentException("只有待发货商品可以取消发货");
        require(jdbc.sql("""
          UPDATE order_item SET fulfillment_status=:status,logistics_company=:company,
            logistics_no=:logisticsNo,logistics_status=:logisticsStatus,
            shipped_at=CASE WHEN :status>0 THEN COALESCE(shipped_at,NOW()) ELSE NULL END
          WHERE id=:itemId AND order_main_id=:orderId
          """).params(Map.of("status",r.fulfillmentStatus(),"company",value(r.logisticsCompany()),
            "logisticsNo",value(r.logisticsNo()),"logisticsStatus",value(r.logisticsStatus()),
            "itemId",itemId,"orderId",orderId)).update(),"订单商品不存在");
        Map<String,Object> stats=jdbc.sql("""
          SELECT COUNT(*) total,
            SUM(CASE WHEN fulfillment_status>=1 AND fulfillment_status<>4 THEN 1 ELSE 0 END) shipped,
            SUM(CASE WHEN fulfillment_status=3 THEN 1 ELSE 0 END) delivered
          FROM order_item WHERE order_main_id=:orderId
          """).param("orderId",orderId).query().singleRow();
        int total=((Number)stats.get("total")).intValue();
        int shipped=((Number)stats.get("shipped")).intValue();
        int delivered=((Number)stats.get("delivered")).intValue();
        int orderStatus=shipped==0?1:(shipped<total?5:(delivered==total?3:2));
        jdbc.sql("UPDATE order_main SET order_status=:status WHERE id=:id AND order_status<>4")
          .params(Map.of("status",orderStatus,"id",orderId)).update();
        addOrderEvent(orderId,"ITEM_LOGISTICS",currentOrderStatus,orderStatus,
          "商品物流状态更新为"+fulfillmentName(r.fulfillmentStatus()));
    }

    @PutMapping("/orders/{id}/status")
    @Transactional
    void orderStatus(@PathVariable long id,@RequestBody OrderStatusRequest r) {
        List<Map<String,Object>> orders=jdbc.sql("""
          SELECT order_status AS orderStatus,payment_status AS paymentStatus,refund_status AS refundStatus
          FROM order_main WHERE id=:id FOR UPDATE
          """).param("id",id).query().listOfRows();
        if(orders.isEmpty()) throw new IllegalArgumentException("订单不存在");
        int current=((Number)orders.getFirst().get("orderStatus")).intValue();
        int refund=((Number)orders.getFirst().get("refundStatus")).intValue();
        if(refund!=0) throw new IllegalArgumentException("退款订单不能推进状态");
        boolean confirmPayment=current==0&&r.orderStatus()==1&&r.paymentStatus()==2;
        boolean complete=current==2&&r.orderStatus()==3;
        if(!confirmPayment&&!complete)
            throw new IllegalArgumentException("当前订单状态不允许执行该操作");
        if(complete) {
            long pending=jdbc.sql("""
              SELECT COUNT(*) FROM order_item
              WHERE order_main_id=:id AND fulfillment_status IN (0,4)
              """).param("id",id).query(Long.class).single();
            if(pending>0) throw new IllegalArgumentException("订单仍有待发货或已取消商品，不能完成订单");
            jdbc.sql("""
              UPDATE order_item SET fulfillment_status=3,
                logistics_status='已签收'
              WHERE order_main_id=:id AND fulfillment_status IN (1,2)
              """).param("id",id).update();
        }
        require(jdbc.sql("UPDATE order_main SET payment_status=:paymentStatus,order_status=:orderStatus WHERE id=:id AND order_status=:current")
          .params(Map.of("id",id,"current",current,"paymentStatus",r.paymentStatus(),"orderStatus",r.orderStatus())).update(),"订单状态已变化，请刷新后重试");
        addOrderEvent(id,confirmPayment?"PAYMENT_CONFIRMED":"ORDER_COMPLETED",current,r.orderStatus(),
          confirmPayment?"确认银行转账到账":"确认订单完成，商品同步签收");
    }

    @PostMapping("/orders/{id}/refund")
    @Transactional
    void refundOrder(@PathVariable long id,@Valid @RequestBody RefundRequest r) {
        List<Map<String,Object>> orders=jdbc.sql("""
          SELECT order_status AS orderStatus,refund_status AS refundStatus,payable_amount AS payableAmount
          FROM order_main WHERE id=:id
          """).param("id",id).query().listOfRows();
        if(orders.isEmpty()) throw new IllegalArgumentException("订单不存在");
        Map<String,Object> order=orders.get(0);
        if(((Number)order.get("orderStatus")).intValue()!=3)
            throw new IllegalArgumentException("只有已完成订单可以退款");
        if(((Number)order.get("refundStatus")).intValue()!=0)
            throw new IllegalArgumentException("订单已经退款，不能重复操作");
        BigDecimal payable=(BigDecimal)order.get("payableAmount");
        if(r.refundAmount().compareTo(BigDecimal.ZERO)<=0||r.refundAmount().compareTo(payable)>0)
            throw new IllegalArgumentException("退款金额必须大于0且不能超过订单实付金额");
        require(jdbc.sql("""
          UPDATE order_main SET refund_status=1,refund_amount=:amount,refund_reason=:reason,refunded_at=NOW()
          WHERE id=:id AND refund_status=0
          """).params(Map.of("id",id,"amount",r.refundAmount(),"reason",r.refundReason())).update(),
          "订单退款状态已变化，请刷新后重试");
        addOrderEvent(id,"ORDER_REFUNDED",3,3,
          "退款¥"+r.refundAmount().toPlainString()+"，原因："+r.refundReason());
    }

    private void addOrderEvent(long orderId,String type,Integer fromStatus,Integer toStatus,String description) {
        jdbc.sql("""
          INSERT INTO order_event(order_main_id,event_type,from_status,to_status,description,operator_type)
          VALUES(:orderId,:type,:fromStatus,:toStatus,:description,'ADMIN')
          """).params(Map.of("orderId",orderId,"type",type,"fromStatus",fromStatus,
            "toStatus",toStatus,"description",description)).update();
    }
    private static String fulfillmentName(int status) {
        return switch(status) {case 0->"待发货";case 1->"已发货";case 2->"运输中";case 3->"已签收";case 4->"已取消";default->"未知";};
    }

    private static String value(String s){return s==null?"":s;}
    private static void require(int n,String message){if(n==0)throw new IllegalArgumentException(message);}
    private void validateCategoryParent(Long id,Long parentId,int level) {
        if(level<1||level>3) throw new IllegalArgumentException("分类级别必须为1至3级");
        if(level==1&&parentId!=null) throw new IllegalArgumentException("一级分类不能设置上级分类");
        if(level>1&&parentId==null) throw new IllegalArgumentException("二级或三级分类必须选择上级分类");
        if(id!=null&&id.equals(parentId)) throw new IllegalArgumentException("分类不能选择自身为上级");
        if(parentId!=null) {
            int parentLevel=jdbc.sql("SELECT level FROM category WHERE id=:id AND deleted_at IS NULL")
              .param("id",parentId).query(Integer.class).optional()
              .orElseThrow(()->new IllegalArgumentException("上级分类不存在"));
            if(parentLevel!=level-1) throw new IllegalArgumentException("上级分类级别不正确");
        }
    }
    private static void validatePassword(String password,boolean required) {
        if(required&&(password==null||password.isBlank()))
            throw new IllegalArgumentException("初始密码不能为空");
        if(password!=null&&!password.isBlank()&&(password.length()<8||password.length()>72))
            throw new IllegalArgumentException("密码长度必须为8至72位");
    }
    public record ProductRequest(@NotBlank String title,@NotNull Long categoryId,@NotNull Long brandId,
        @NotBlank String mainImage,String gallery,String attributes,String summary,String detailHtml,
        String deliveryDescription,String afterSalesHtml,String spec,
      @NotNull @DecimalMin("0") BigDecimal marketPrice,@NotNull @DecimalMin("0") BigDecimal memberPrice,@Min(0) int stock,int status){
        public ProductRequest {
            long galleryCount=gallery==null?0:gallery.lines().filter(line->!line.isBlank()).count();
            if(galleryCount>6) throw new IllegalArgumentException("商品配图最多上传6张");
        }
    }
    public record CategoryRequest(@NotBlank String name,Long parentId,@Min(1) int level,
      @Min(0) int sortOrder,String icon,int status){}
    public record EnterpriseRequest(@NotBlank String name,@NotBlank String creditCode,@NotBlank String contactName,
      @NotBlank String contactPhone,String address,int status){}
    public record EnterpriseMemberRequest(@NotBlank String username,@NotBlank String realName,
      @NotBlank String phone,@NotBlank String roleCode,int status,String password){}
    public record AgreementRequest(@NotNull Long enterpriseId,@NotBlank String name,@NotNull @DecimalMin("0") BigDecimal amount,
      @NotBlank String effectiveDate,@NotBlank String expiryDate,int status){}
    public record StatusRequest(int status){}
    public record StockRequest(@Min(0) int stock){}
    public record OrderStatusRequest(int paymentStatus,int orderStatus){}
    public record ItemLogisticsRequest(int fulfillmentStatus,String logisticsCompany,
        String logisticsNo,String logisticsStatus){}
    public record RefundRequest(@NotNull @DecimalMin("0.01") BigDecimal refundAmount,
        @NotBlank String refundReason){}
}
