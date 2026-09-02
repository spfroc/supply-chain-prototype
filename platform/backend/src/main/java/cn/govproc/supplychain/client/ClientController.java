package cn.govproc.supplychain.client;

import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.auth.EnterpriseAuthorizationService;
import cn.govproc.supplychain.order.OrderInventoryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/client")
public class ClientController {
    private final ClientAuthService auth;
    private final EnterpriseAuthorizationService authorization;

    private final JdbcClient jdbc;
    private final OrderInventoryService inventory;
    private final PasswordEncoder passwordEncoder;

    public ClientController(JdbcClient jdbc, ClientAuthService auth, EnterpriseAuthorizationService authorization,
                            OrderInventoryService inventory,
                            PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.authorization = authorization;
        this.inventory = inventory;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/profile")
    Map<String, Object> profile() {
        return jdbc.sql("""
            SELECT u.id, u.username, u.real_name AS realName, u.phone, u.role_code AS roleCode,
              e.id AS enterpriseId, e.name AS enterpriseName,
              a.id AS agreementId, a.name AS agreementName,
              DATE_FORMAT(a.expiry_date, '%Y-%m-%d') AS agreementExpiry
            FROM enterprise_user u
            JOIN enterprise e ON e.id=u.enterprise_id
            LEFT JOIN agreement a ON a.enterprise_id=e.id AND a.status=1
              AND CURRENT_DATE BETWEEN a.effective_date AND a.expiry_date AND a.deleted_at IS NULL
            WHERE u.id=:id
            ORDER BY a.id DESC LIMIT 1
            """).param("id", userId()).query().singleRow();
    }

    @GetMapping("/summary")
    Map<String,Object> summary() {
        return jdbc.sql("""
          SELECT
            (SELECT COALESCE(SUM(payable_amount),0) FROM order_main
              WHERE user_id=:userId AND created_at>=DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')) AS monthlyPurchase,
            (SELECT COALESCE(SUM((s.market_price-oi.unit_price)*oi.quantity),0)
              FROM order_main o JOIN order_item oi ON oi.order_main_id=o.id JOIN product_sku s ON s.id=oi.sku_id
              WHERE o.user_id=:userId) AS totalSavings,
            (SELECT COUNT(*) FROM order_main WHERE user_id=:userId AND order_status<3) AS activeOrders,
            (SELECT COUNT(*) FROM order_main WHERE user_id=:userId AND payment_status=0) AS pendingPayment,
            (SELECT COUNT(*) FROM enterprise_user WHERE enterprise_id=:enterpriseId AND deleted_at IS NULL) AS memberCount,
            (SELECT COUNT(*) FROM address WHERE user_id=:userId AND deleted_at IS NULL) AS addressCount,
            (SELECT COUNT(*) FROM invoice_record WHERE enterprise_id=:enterpriseId) AS invoiceCount,
            (SELECT COUNT(*) FROM agreement_item ai JOIN agreement a ON a.id=ai.agreement_id
              WHERE a.enterprise_id=:enterpriseId AND a.status=1 AND a.deleted_at IS NULL
                AND ai.status=1 AND ai.deleted_at IS NULL) AS agreementItemCount
          """).params(Map.of("userId",userId(),"enterpriseId",enterpriseId())).query().singleRow();
    }

    @GetMapping("/addresses")
    List<Map<String, Object>> addresses() {
        return jdbc.sql("""
            SELECT id, contact_name AS contactName, contact_phone AS contactPhone, province, city,
              district, detail, is_default AS isDefault
            FROM address WHERE user_id=:userId AND deleted_at IS NULL ORDER BY is_default DESC,id
            """).param("userId", userId()).query().listOfRows();
    }

    @PostMapping("/addresses")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    void createAddress(@Valid @RequestBody AddressRequest request) {
        if (request.isDefault() == 1) {
            jdbc.sql("UPDATE address SET is_default=0 WHERE user_id=:userId AND deleted_at IS NULL")
                .param("userId", userId()).update();
        }
        jdbc.sql("""
            INSERT INTO address(enterprise_id,user_id,contact_name,contact_phone,province,city,district,detail,is_default)
            VALUES(:enterpriseId,:userId,:contactName,:contactPhone,:province,:city,:district,:detail,:isDefault)
            """).params(Map.of("enterpriseId", enterpriseId(), "userId", userId(),
                "contactName", request.contactName(), "contactPhone", request.contactPhone(),
                "province", request.province(), "city", request.city(), "district", request.district(),
                "detail", request.detail(), "isDefault", request.isDefault())).update();
    }

    @PutMapping("/addresses/{id}")
    @Transactional
    void updateAddress(@PathVariable long id, @Valid @RequestBody AddressRequest request) {
        if (request.isDefault() == 1) {
            jdbc.sql("UPDATE address SET is_default=0 WHERE user_id=:userId AND id<>:id AND deleted_at IS NULL")
                .params(Map.of("userId", userId(), "id", id)).update();
        }
        int changed = jdbc.sql("""
            UPDATE address SET contact_name=:contactName,contact_phone=:contactPhone,province=:province,
              city=:city,district=:district,detail=:detail,is_default=:isDefault
            WHERE id=:id AND user_id=:userId AND deleted_at IS NULL
            """).params(Map.of("id", id, "userId", userId(), "contactName", request.contactName(),
                "contactPhone", request.contactPhone(), "province", request.province(), "city", request.city(),
                "district", request.district(), "detail", request.detail(), "isDefault", request.isDefault())).update();
        if (changed == 0) throw new IllegalArgumentException("地址不存在");
    }

    @DeleteMapping("/addresses/{id}")
    void deleteAddress(@PathVariable long id) {
        int changed = jdbc.sql("UPDATE address SET deleted_at=NOW(),is_default=0 WHERE id=:id AND user_id=:userId AND deleted_at IS NULL")
            .params(Map.of("id", id, "userId", userId())).update();
        if (changed == 0) throw new IllegalArgumentException("地址不存在");
    }

    @GetMapping("/members")
    List<Map<String,Object>> members() {
        return jdbc.sql("""
            SELECT u.id,u.username,u.real_name AS realName,u.phone,u.role_code AS roleCode,u.status,
              u.department_id AS departmentId,d.name AS departmentName,
              GROUP_CONCAT(DISTINCT r.name ORDER BY r.id) AS roleNames,
              GROUP_CONCAT(DISTINCT r.id ORDER BY r.id) AS roleIds,
              DATE_FORMAT(u.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
            FROM enterprise_user u
            LEFT JOIN enterprise_department d ON d.id=u.department_id AND d.deleted_at IS NULL
            LEFT JOIN enterprise_user_role ur ON ur.user_id=u.id
            LEFT JOIN enterprise_role r ON r.id=ur.role_id AND r.deleted_at IS NULL
            WHERE u.enterprise_id=:enterpriseId AND u.deleted_at IS NULL
            GROUP BY u.id,d.name ORDER BY u.id
            """).param("enterpriseId", enterpriseId()).query().listOfRows();
    }

    @PostMapping("/members")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    void createMember(@Valid @RequestBody MemberRequest request) {
        requireEnterpriseAdmin();
        jdbc.sql("""
            INSERT INTO enterprise_user(enterprise_id,username,password_hash,real_name,phone,role_code,status)
            VALUES(:enterpriseId,:username,:password,:realName,:phone,:roleCode,:status)
            """).params(Map.of("enterpriseId", enterpriseId(), "username", request.username(),
                "password", passwordEncoder.encode("demo-password"),
                "realName", request.realName(), "phone", request.phone(), "roleCode", request.roleCode(),
                "status", request.status())).update();
        long memberId=jdbc.sql("SELECT id FROM enterprise_user WHERE enterprise_id=:enterpriseId AND username=:username")
            .params(Map.of("enterpriseId",enterpriseId(),"username",request.username())).query(Long.class).single();
        syncLegacyRole(memberId,request.roleCode());
    }

    @PutMapping("/members/{id}")
    @Transactional
    void updateMember(@PathVariable long id,@Valid @RequestBody MemberRequest request) {
        requireEnterpriseAdmin();
        int changed=jdbc.sql("""
            UPDATE enterprise_user SET username=:username,real_name=:realName,phone=:phone,role_code=:roleCode,status=:status
            WHERE id=:id AND enterprise_id=:enterpriseId AND deleted_at IS NULL
            """).params(Map.of("id",id,"enterpriseId",enterpriseId(),"username",request.username(),
                "realName",request.realName(),"phone",request.phone(),"roleCode",request.roleCode(),"status",request.status())).update();
        if(changed==0)throw new IllegalArgumentException("企业成员不存在");
        syncLegacyRole(id,request.roleCode());
    }

    @DeleteMapping("/members/{id}")
    void deleteMember(@PathVariable long id) {
        requireEnterpriseAdmin();
        if(id==userId())throw new IllegalArgumentException("当前企业主账号不能删除");
        int changed=jdbc.sql("UPDATE enterprise_user SET deleted_at=NOW(),status=0 WHERE id=:id AND enterprise_id=:enterpriseId AND deleted_at IS NULL")
            .params(Map.of("id",id,"enterpriseId",enterpriseId())).update();
        if(changed==0)throw new IllegalArgumentException("企业成员不存在");
    }

    @GetMapping("/invoices")
    List<Map<String,Object>> invoices() {
        return jdbc.sql("""
            SELECT i.id,i.invoice_no AS invoiceNo,o.order_no AS orderNo,i.title,i.tax_no AS taxNo,
              i.invoice_type AS invoiceType,i.amount,i.status,
              DATE_FORMAT(i.issued_at,'%Y-%m-%d %H:%i:%s') AS issuedAt,
              DATE_FORMAT(i.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,i.remark
            FROM invoice_record i JOIN order_main o ON o.id=i.order_main_id
            WHERE i.enterprise_id=:enterpriseId ORDER BY i.id DESC
            """).param("enterpriseId",enterpriseId()).query().listOfRows();
    }

    @GetMapping("/cart")
    List<Map<String, Object>> cart() {
        return jdbc.sql("""
            SELECT c.id, c.sku_id AS skuId, c.solution_id AS solutionId,c.quantity, c.selected, p.title, p.main_image AS mainImage,
              s.sku_code AS skuCode, s.spec_json AS specJson, s.stock-s.reserved_stock AS availableStock,
              s.market_price AS marketPrice, s.member_price AS memberPrice,
              COALESCE(ai.agreement_price,s.market_price) AS salePrice,
              CASE WHEN ai.id IS NULL THEN 0 ELSE 1 END AS agreementPriced
            FROM cart_item c
            JOIN product_sku s ON s.id=c.sku_id
            JOIN product_spu p ON p.id=s.spu_id
            LEFT JOIN agreement a ON a.enterprise_id=:enterpriseId AND a.status=1
              AND CURRENT_DATE BETWEEN a.effective_date AND a.expiry_date AND a.deleted_at IS NULL
            LEFT JOIN agreement_item ai ON ai.agreement_id=a.id AND ai.sku_id=s.id
              AND ai.status=1 AND ai.deleted_at IS NULL
            WHERE c.user_id=:userId ORDER BY c.id
            """).params(Map.of("enterpriseId", enterpriseId(), "userId", userId()))
            .query().listOfRows();
    }

    @PostMapping("/cart")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    void addCart(@Valid @RequestBody CartRequest request) {
        int stock = jdbc.sql("SELECT stock-reserved_stock FROM product_sku WHERE id=:id AND status=1 AND deleted_at IS NULL")
            .param("id", request.skuId()).query(Integer.class)
            .optional().orElseThrow(() -> new IllegalArgumentException("商品不存在或已下架"));
        if (request.quantity() > stock) throw new IllegalArgumentException("加入数量不能超过可售库存");
        var existingId = jdbc.sql("""
            SELECT id FROM cart_item WHERE user_id=:userId AND sku_id=:skuId
              AND solution_id <=> :solutionId LIMIT 1
            """).param("userId", userId()).param("skuId", request.skuId())
            .param("solutionId", request.solutionId())
            .query(Long.class).optional();
        if (existingId.isPresent()) {
            jdbc.sql("UPDATE cart_item SET quantity=LEAST(quantity+:quantity,:stock),selected=1 WHERE id=:id")
                .params(Map.of("quantity", request.quantity(), "stock", stock, "id", existingId.get())).update();
        } else {
            jdbc.sql("INSERT INTO cart_item(user_id,sku_id,solution_id,quantity,selected) VALUES(:userId,:skuId,:solutionId,:quantity,1)")
                .param("userId", userId()).param("skuId", request.skuId())
                .param("solutionId", request.solutionId()).param("quantity", request.quantity()).update();
        }
    }

    @PutMapping("/cart/{id}")
    void updateCart(@PathVariable long id, @Valid @RequestBody CartUpdateRequest request) {
        int stock = jdbc.sql("""
            SELECT s.stock-s.reserved_stock FROM cart_item c JOIN product_sku s ON s.id=c.sku_id
            WHERE c.id=:id AND c.user_id=:userId
            """).params(Map.of("id", id, "userId", userId())).query(Integer.class)
            .optional().orElseThrow(() -> new IllegalArgumentException("购物车商品不存在"));
        if (request.quantity() > stock) throw new IllegalArgumentException("购买数量不能超过可售库存");
        jdbc.sql("UPDATE cart_item SET quantity=:quantity,selected=:selected WHERE id=:id AND user_id=:userId")
            .params(Map.of("quantity", request.quantity(), "selected", request.selected(),
                "id", id, "userId", userId())).update();
    }

    @DeleteMapping("/cart/{id}")
    void deleteCart(@PathVariable long id) {
        int changed = jdbc.sql("DELETE FROM cart_item WHERE id=:id AND user_id=:userId")
            .params(Map.of("id", id, "userId", userId())).update();
        if (changed == 0) throw new IllegalArgumentException("购物车商品不存在");
    }

    @GetMapping("/orders")
    List<Map<String, Object>> orders() {
        return jdbc.sql("""
            SELECT o.id, o.order_no AS orderNo, o.item_amount AS itemAmount, o.freight_amount AS freightAmount,
              o.payable_amount AS payableAmount, o.payment_status AS paymentStatus, o.order_status AS orderStatus,
              o.refund_status AS refundStatus,o.refund_amount AS refundAmount,
              DATE_FORMAT(o.payment_due_at, '%Y-%m-%d %H:%i:%s') AS paymentDueAt,
              DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
              COUNT(DISTINCT oi.id) AS itemKinds, COALESCE(SUM(oi.quantity),0) AS itemCount,
              MAX(p.main_image) AS mainImage
            FROM order_main o
            LEFT JOIN order_item oi ON oi.order_main_id=o.id
            LEFT JOIN product_sku s ON s.id=oi.sku_id
            LEFT JOIN product_spu p ON p.id=s.spu_id
            WHERE o.user_id=:userId GROUP BY o.id ORDER BY o.id DESC
            """).param("userId", userId()).query().listOfRows();
    }

    @GetMapping("/orders/{id}")
    Map<String,Object> order(@PathVariable long id) {
        var orders=jdbc.sql("""
            SELECT o.id,o.order_no AS orderNo,o.item_amount AS itemAmount,o.freight_amount AS freightAmount,
              o.payable_amount AS payableAmount,o.payment_status AS paymentStatus,o.order_status AS orderStatus,
              o.refund_status AS refundStatus,o.refund_amount AS refundAmount,o.refund_reason AS refundReason,
              DATE_FORMAT(o.refunded_at,'%Y-%m-%d %H:%i:%s') AS refundedAt,
              DATE_FORMAT(o.payment_due_at,'%Y-%m-%d %H:%i:%s') AS paymentDueAt,
              o.payment_bank_snapshot AS paymentBankSnapshot,DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
            FROM order_main o WHERE o.id=:id AND o.user_id=:userId
            """).params(Map.of("id",id,"userId",userId())).query().listOfRows();
        if(orders.isEmpty())throw new IllegalArgumentException("订单不存在");
        var items=jdbc.sql("""
            SELECT oi.id AS orderItemId,p.title,p.main_image AS mainImage,s.sku_code AS skuCode,os.sub_order_no AS subOrderNo,
              os.address_snapshot AS addressSnapshot,
              oi.quantity,oi.unit_price AS unitPrice,oi.total_price AS totalPrice,
              oi.fulfillment_status AS fulfillmentStatus,oi.logistics_company AS logisticsCompany,
              oi.logistics_no AS logisticsNo,oi.logistics_status AS logisticsStatus,
              DATE_FORMAT(oi.shipped_at,'%Y-%m-%d %H:%i:%s') AS shippedAt
            FROM order_item oi JOIN product_sku s ON s.id=oi.sku_id JOIN product_spu p ON p.id=s.spu_id
            JOIN order_sub os ON os.id=oi.order_sub_id
            WHERE oi.order_main_id=:id
            """).param("id",id).query().listOfRows();
        var deliveries=jdbc.sql("""
            SELECT os.sub_order_no AS subOrderNo,os.address_snapshot AS addressSnapshot,
              COALESCE(NULLIF(os.logistics_company,''),MAX(oi.logistics_company)) AS logisticsCompany,
              COALESCE(NULLIF(os.logistics_no,''),MAX(oi.logistics_no)) AS logisticsNo,
              COALESCE(NULLIF(os.logistics_status,''),MAX(oi.logistics_status)) AS logisticsStatus,
              CASE WHEN SUM(oi.fulfillment_status IN (1,2))>0 THEN 2
                WHEN SUM(oi.fulfillment_status=3)>0 AND SUM(oi.fulfillment_status NOT IN (3,4))=0 THEN 3
                ELSE os.status END AS status
            FROM order_sub os JOIN order_item oi ON oi.order_sub_id=os.id
            WHERE os.order_main_id=:id GROUP BY os.id
            """).param("id",id).query().listOfRows();
        return Map.of("order",orders.getFirst(),"items",items,"deliveries",deliveries);
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    Map<String, Object> checkout(@RequestBody(required = false) CheckoutRequest request) {
        String idempotencyKey = request != null && request.idempotencyKey() != null
            ? request.idempotencyKey() : UUID.randomUUID().toString();
        var existing = jdbc.sql("SELECT id,order_no AS orderNo FROM order_main WHERE enterprise_id=:enterpriseId AND idempotency_key=:key")
            .params(Map.of("enterpriseId", enterpriseId(), "key", idempotencyKey)).query().listOfRows();
        if (!existing.isEmpty()) return existing.getFirst();
        if(request==null||request.bankAccountId()==null)throw new IllegalArgumentException("请选择收款银行账号");
        var bankAccounts=jdbc.sql("SELECT id,account_name AS accountName,bank_name AS bankName,account_number AS accountNumber,branch_name AS branchName FROM payment_bank_account WHERE id=:id AND status=1 AND deleted_at IS NULL")
            .param("id",request.bankAccountId()).query().listOfRows();
        if(bankAccounts.isEmpty())throw new IllegalArgumentException("所选收款银行账号不存在或已停用");
        var bankAccount=bankAccounts.getFirst();

        Long agreementId = jdbc.sql("""
            SELECT id FROM agreement WHERE enterprise_id=:enterpriseId AND status=1 AND deleted_at IS NULL
              AND CURRENT_DATE BETWEEN effective_date AND expiry_date ORDER BY id DESC LIMIT 1
            """).param("enterpriseId", enterpriseId()).query(Long.class)
            .optional().orElse(null);
        List<Map<String, Object>> lines = jdbc.sql("""
            SELECT c.id AS cartId,c.sku_id AS skuId,c.quantity,p.title,s.sku_code AS skuCode,
              CAST(s.spec_json AS CHAR) AS skuSpecs,COALESCE(NULLIF(s.sku_image,''),p.main_image,'') AS skuImage,
              COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('name',ad.name,'value',pav.value_text,'unit',ad.unit))
                FROM product_attribute_value pav JOIN attribute_definition ad ON ad.id=pav.attribute_id
                WHERE pav.product_id=p.id AND ad.visible_flag=1),JSON_ARRAY()) AS attributeSnapshot,
              s.stock-s.reserved_stock AS availableStock,COALESCE(ai.agreement_price,s.market_price) AS unitPrice
            FROM cart_item c JOIN product_sku s ON s.id=c.sku_id JOIN product_spu p ON p.id=s.spu_id
            LEFT JOIN agreement_item ai ON ai.agreement_id=:agreementId AND ai.sku_id=s.id
              AND ai.status=1 AND ai.deleted_at IS NULL
            WHERE c.user_id=:userId AND c.selected=1
            """).param("agreementId",agreementId).param("userId",userId()).query().listOfRows();
        if (lines.isEmpty()) throw new IllegalArgumentException("请先选择需要结算的商品");
        for (var line : lines) {
            if (((Number) line.get("quantity")).intValue() > ((Number) line.get("availableStock")).intValue()) {
                throw new IllegalArgumentException(line.get("title") + "库存不足");
            }
        }
        BigDecimal amount = lines.stream().map(line ->
            ((BigDecimal) line.get("unitPrice")).multiply(BigDecimal.valueOf(((Number) line.get("quantity")).longValue()))
        ).reduce(BigDecimal.ZERO, BigDecimal::add);
        var addresses = jdbc.sql("""
            SELECT id,contact_name AS contactName,contact_phone AS contactPhone,
              CONCAT(province,city,district,detail) AS fullAddress
            FROM address WHERE user_id=:userId AND deleted_at IS NULL ORDER BY is_default DESC,id
            """).param("userId", userId()).query().listOfRows();
        if (addresses.isEmpty()) throw new IllegalArgumentException("请先维护收货地址");
        Map<Long, Map<String, Object>> addressById = new HashMap<>();
        for (var address : addresses) {
            addressById.put(((Number) address.get("id")).longValue(), address);
        }
        Map<Long, Map<String, Object>> lineBySku = new HashMap<>();
        for (var line : lines) {
            lineBySku.put(((Number) line.get("skuId")).longValue(), line);
        }
        List<DeliveryAllocation> allocations = new ArrayList<>();
        if (request == null || request.allocations() == null || request.allocations().isEmpty()) {
            long defaultAddressId = ((Number) addresses.getFirst().get("id")).longValue();
            for (var line : lines) {
                allocations.add(new DeliveryAllocation(
                    ((Number) line.get("skuId")).longValue(),
                    defaultAddressId,
                    ((Number) line.get("quantity")).intValue()
                ));
            }
        } else {
            Map<Long, Integer> allocatedBySku = new HashMap<>();
            for (var allocation : request.allocations()) {
                if (allocation == null || allocation.skuId() == null || allocation.addressId() == null
                    || allocation.quantity() < 1) {
                    throw new IllegalArgumentException("配送地址和分配数量不能为空");
                }
                if (!lineBySku.containsKey(allocation.skuId())) {
                    throw new IllegalArgumentException("配送商品不在当前结算清单中");
                }
                if (!addressById.containsKey(allocation.addressId())) {
                    throw new IllegalArgumentException("配送地址不存在或不属于当前用户");
                }
                allocatedBySku.merge(allocation.skuId(), allocation.quantity(), Integer::sum);
                allocations.add(allocation);
            }
            for (var line : lines) {
                long skuId = ((Number) line.get("skuId")).longValue();
                int quantity = ((Number) line.get("quantity")).intValue();
                if (allocatedBySku.getOrDefault(skuId, 0) != quantity) {
                    throw new IllegalArgumentException(line.get("title") + "的地址分配数量必须等于购买数量");
                }
            }
        }
        String orderNo = "PO" + System.currentTimeMillis()
            + String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
        jdbc.sql("""
            INSERT INTO order_main(order_no,enterprise_id,user_id,agreement_id,item_amount,freight_amount,
              payable_amount,payment_status,order_status,price_version,idempotency_key,payment_due_at,payment_bank_account_id,payment_bank_snapshot)
            VALUES(:orderNo,:enterpriseId,:userId,:agreementId,:amount,0,:amount,0,0,:priceVersion,:key,DATE_ADD(NOW(),INTERVAL 48 HOUR),:bankId,
              JSON_OBJECT('accountName',:accountName,'bankName',:bankName,'accountNumber',:accountNumber,'branchName',:branchName))
            """).param("orderNo",orderNo).param("enterpriseId",enterpriseId()).param("userId",userId())
            .param("agreementId",agreementId).param("amount",amount).param("priceVersion",UUID.randomUUID().toString())
            .param("key",idempotencyKey).param("bankId",request.bankAccountId()).param("accountName",bankAccount.get("accountName"))
            .param("bankName",bankAccount.get("bankName")).param("accountNumber",bankAccount.get("accountNumber")).param("branchName",bankAccount.get("branchName")).update();
        long orderId = jdbc.sql("SELECT id FROM order_main WHERE order_no=:orderNo").param("orderNo", orderNo).query(Long.class).single();
        Map<Long, Long> subOrderByAddress = new HashMap<>();
        for (var allocation : allocations) {
            long addressId = allocation.addressId();
            Long subOrderId = subOrderByAddress.get(addressId);
            if (subOrderId == null) {
                Map<String, Object> address = addressById.get(addressId);
                String subOrderNo = orderNo + "-" + String.format("%02d", subOrderByAddress.size() + 1);
                jdbc.sql("""
                    INSERT INTO order_sub(order_main_id,sub_order_no,address_snapshot,status)
                    VALUES(:orderId,:subOrderNo,JSON_OBJECT('addressId',:addressId,'contactName',:contactName,'phone',:phone,'address',:address),0)
                    """).params(Map.of("orderId", orderId, "subOrderNo", subOrderNo, "addressId", addressId,
                        "contactName", address.get("contactName"), "phone", address.get("contactPhone"),
                        "address", address.get("fullAddress"))).update();
                subOrderId = jdbc.sql("SELECT id FROM order_sub WHERE sub_order_no=:subOrderNo")
                    .param("subOrderNo", subOrderNo).query(Long.class).single();
                subOrderByAddress.put(addressId, subOrderId);
            }
            Map<String, Object> line = lineBySku.get(allocation.skuId());
            long skuId = allocation.skuId();
            int quantity = allocation.quantity();
            BigDecimal unitPrice = (BigDecimal) line.get("unitPrice");
            jdbc.sql("""
                INSERT INTO order_item(order_main_id,order_sub_id,sku_id,quantity,unit_price,total_price,snapshot_json)
                VALUES(:orderId,:subOrderId,:skuId,:quantity,:unitPrice,:total,
                  JSON_OBJECT('title',:title,'skuCode',:skuCode,'image',:image,
                    'skuSpecs',CAST(:skuSpecs AS JSON),'attributes',CAST(:attributeSnapshot AS JSON)))
                """).params(Map.ofEntries(Map.entry("orderId",orderId),Map.entry("subOrderId",subOrderId),
                    Map.entry("skuId",skuId),Map.entry("quantity",quantity),Map.entry("unitPrice",unitPrice),
                    Map.entry("total",unitPrice.multiply(BigDecimal.valueOf(quantity))),Map.entry("title",line.get("title")),
                    Map.entry("skuCode",line.get("skuCode")),Map.entry("image",line.get("skuImage")),
                    Map.entry("skuSpecs",line.get("skuSpecs")),
                    Map.entry("attributeSnapshot",String.valueOf(line.get("attributeSnapshot"))))).update();
            jdbc.sql("UPDATE product_sku SET reserved_stock=reserved_stock+:quantity WHERE id=:skuId")
                .params(Map.of("quantity", quantity, "skuId", skuId)).update();
        }
        jdbc.sql("DELETE FROM cart_item WHERE user_id=:userId AND selected=1").param("userId", userId()).update();
        return Map.of("id", orderId, "orderNo", orderNo, "payableAmount", amount, "paymentMethod", "银行转账");
    }

    @PostMapping("/orders/{id}/cancel")
    @Transactional
    void cancelOrder(@PathVariable long id) {
        int changed=jdbc.sql("""
            UPDATE order_main SET order_status=4
            WHERE id=:id AND user_id=:userId AND enterprise_id=:enterpriseId
              AND order_status=0 AND payment_status=0
            """).params(Map.of("id",id,"userId",userId(),"enterpriseId",enterpriseId())).update();
        if(changed!=1) throw new IllegalArgumentException("仅待付款订单可以取消");
        inventory.releaseReserved(id);
        jdbc.sql("""
            INSERT INTO order_event(order_main_id,event_type,from_status,to_status,description,operator_type)
            VALUES(:id,'ORDER_CANCELLED',0,4,'采购人主动取消订单','CLIENT')
            """).param("id",id).update();
    }

    private long userId() { return auth.current().userId(); }
    private long enterpriseId() { return auth.current().enterpriseId(); }
    private void syncLegacyRole(long memberId,String roleCode) {
        List<Long> roleIds=jdbc.sql("""
            SELECT id FROM enterprise_role
            WHERE enterprise_id=:enterpriseId AND role_code=:roleCode AND status=1 AND deleted_at IS NULL
            """).params(Map.of("enterpriseId",enterpriseId(),"roleCode",roleCode)).query(Long.class).list();
        if(roleIds.isEmpty())return;
        jdbc.sql("DELETE ur FROM enterprise_user_role ur JOIN enterprise_role r ON r.id=ur.role_id WHERE ur.user_id=:memberId AND r.built_in=1")
            .param("memberId",memberId).update();
        jdbc.sql("INSERT IGNORE INTO enterprise_user_role(user_id,role_id) VALUES(:memberId,:roleId)")
            .params(Map.of("memberId",memberId,"roleId",roleIds.getFirst())).update();
    }
    private void requireEnterpriseAdmin() {
        authorization.require("organization:manage");
    }

    public record CartRequest(@NotNull Long skuId, Long solutionId, @Min(1) @Max(9999) int quantity) {}
    public record CartUpdateRequest(@Min(1) @Max(9999) int quantity, int selected) {}
    public record CheckoutRequest(String idempotencyKey,List<DeliveryAllocation> allocations,Long bankAccountId) {}
    public record DeliveryAllocation(Long skuId,Long addressId,int quantity) {}
    public record AddressRequest(@NotBlank String contactName,@NotBlank String contactPhone,
        @NotBlank String province,@NotBlank String city,@NotBlank String district,@NotBlank String detail,int isDefault) {}
    public record MemberRequest(@NotBlank String username,@NotBlank String realName,@NotBlank String phone,
        @NotBlank String roleCode,int status) {}
}
