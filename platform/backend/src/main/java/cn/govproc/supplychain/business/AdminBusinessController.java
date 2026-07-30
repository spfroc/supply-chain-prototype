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
            o.payment_status AS paymentStatus,o.order_status AS orderStatus,
            DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,COUNT(oi.id) AS itemKinds,SUM(oi.quantity) AS itemCount
          FROM order_main o JOIN enterprise e ON e.id=o.enterprise_id LEFT JOIN order_item oi ON oi.order_main_id=o.id
          GROUP BY o.id ORDER BY o.id DESC
          """).query().listOfRows();
    }

    @GetMapping("/orders/{id}")
    Map<String,Object> order(@PathVariable long id) {
        var order=jdbc.sql("""
          SELECT o.*,e.name AS enterpriseName,u.real_name AS buyerName
          FROM order_main o JOIN enterprise e ON e.id=o.enterprise_id JOIN enterprise_user u ON u.id=o.user_id WHERE o.id=:id
          """)
          .param("id",id).query().singleRow();
        var items=jdbc.sql("""
          SELECT oi.id,p.title,s.sku_code AS skuCode,oi.quantity,oi.unit_price AS unitPrice,
          oi.total_price AS totalPrice FROM order_item oi JOIN product_sku s ON s.id=oi.sku_id
          JOIN product_spu p ON p.id=s.spu_id WHERE oi.order_main_id=:id
          """).param("id",id).query().listOfRows();
        return Map.of("order",order,"items",items);
    }

    @PutMapping("/orders/{id}/status")
    void orderStatus(@PathVariable long id,@RequestBody OrderStatusRequest r) {
        require(jdbc.sql("UPDATE order_main SET payment_status=:paymentStatus,order_status=:orderStatus WHERE id=:id")
          .params(Map.of("id",id,"paymentStatus",r.paymentStatus(),"orderStatus",r.orderStatus())).update(),"订单不存在");
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
}
