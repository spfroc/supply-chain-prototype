package cn.govproc.supplychain.client;

import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.auth.EnterpriseAuthorizationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/client/finance")
public class FinanceController {
    private final JdbcClient jdbc;
    private final ClientAuthService auth;
    private final EnterpriseAuthorizationService authorization;

    public FinanceController(JdbcClient jdbc, ClientAuthService auth,
                             EnterpriseAuthorizationService authorization) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.authorization = authorization;
    }

    @GetMapping("/summary")
    Map<String, Object> summary() {
        authorization.require("finance:view");
        return jdbc.sql("""
            SELECT
              COALESCE(SUM(CASE WHEN o.payment_status<>2 AND o.order_status<>4 THEN o.payable_amount ELSE 0 END),0) AS outstandingAmount,
              COALESCE(SUM(CASE WHEN o.payment_status<>2 AND o.order_status<>4 AND o.payment_due_at<NOW() THEN o.payable_amount ELSE 0 END),0) AS overdueAmount,
              COUNT(CASE WHEN o.payment_status<>2 AND o.order_status<>4 THEN 1 END) AS payableCount,
              COUNT(CASE WHEN o.payment_status<>2 AND o.order_status<>4 AND o.payment_due_at<NOW() THEN 1 END) AS overdueCount,
              (SELECT COUNT(*) FROM reconciliation_statement s WHERE s.enterprise_id=:enterpriseId AND s.status IN (1,2)) AS pendingStatementCount,
              (SELECT COUNT(*) FROM invoice_application a WHERE a.enterprise_id=:enterpriseId AND a.status IN (0,1)) AS pendingInvoiceCount
            FROM order_main o WHERE o.enterprise_id=:enterpriseId
            """).param("enterpriseId", enterpriseId()).query().singleRow();
    }

    @GetMapping("/profile")
    Map<String, Object> profile() {
        authorization.require("finance:view");
        return jdbc.sql("""
            SELECT invoice_title AS invoiceTitle,tax_no AS taxNo,invoice_type AS invoiceType,
              recipient_email AS recipientEmail,billing_cycle AS billingCycle,
              payment_term_days AS paymentTermDays,credit_limit AS creditLimit,status
            FROM enterprise_finance_profile WHERE enterprise_id=:enterpriseId
            """).param("enterpriseId", enterpriseId()).query().singleRow();
    }

    @PutMapping("/profile")
    void updateProfile(@Valid @RequestBody FinanceProfileRequest request) {
        authorization.require("finance:manage");
        jdbc.sql("""
            UPDATE enterprise_finance_profile SET invoice_title=:invoiceTitle,tax_no=:taxNo,
              invoice_type=:invoiceType,recipient_email=:recipientEmail,payment_term_days=:paymentTermDays
            WHERE enterprise_id=:enterpriseId
            """).param("invoiceTitle", request.invoiceTitle().trim()).param("taxNo", request.taxNo().trim())
            .param("invoiceType", request.invoiceType()).param("recipientEmail", request.recipientEmail())
            .param("paymentTermDays", request.paymentTermDays()).param("enterpriseId", enterpriseId()).update();
    }

    @GetMapping("/payables")
    List<Map<String, Object>> payables() {
        authorization.require("finance:view");
        return jdbc.sql("""
            SELECT o.id,o.order_no AS orderNo,u.real_name AS buyerName,o.payable_amount AS payableAmount,
              o.payment_status AS paymentStatus,o.order_status AS orderStatus,
              CASE WHEN o.payment_status<>2 AND o.order_status<>4 THEN o.payable_amount ELSE 0 END AS outstandingAmount,
              CASE WHEN o.payment_status<>2 AND o.order_status<>4 AND o.payment_due_at<NOW() THEN 1 ELSE 0 END AS overdue,
              DATE_FORMAT(o.payment_due_at,'%Y-%m-%d') AS paymentDueDate,
              DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
              s.statement_no AS statementNo,s.status AS statementStatus
            FROM order_main o JOIN enterprise_user u ON u.id=o.user_id
            LEFT JOIN reconciliation_statement_order so ON so.order_main_id=o.id
            LEFT JOIN reconciliation_statement s ON s.id=so.statement_id
            WHERE o.enterprise_id=:enterpriseId ORDER BY o.id DESC
            """).param("enterpriseId", enterpriseId()).query().listOfRows();
    }

    @GetMapping("/statements")
    List<Map<String, Object>> statements() {
        authorization.require("finance:view");
        return jdbc.sql("""
            SELECT s.id,s.statement_no AS statementNo,DATE_FORMAT(s.period_start,'%Y-%m-%d') AS periodStart,
              DATE_FORMAT(s.period_end,'%Y-%m-%d') AS periodEnd,s.order_count AS orderCount,
              s.item_amount AS itemAmount,s.freight_amount AS freightAmount,s.payable_amount AS payableAmount,
              s.paid_amount AS paidAmount,s.status,DATE_FORMAT(s.due_date,'%Y-%m-%d') AS dueDate,
              DATE_FORMAT(s.confirmed_at,'%Y-%m-%d %H:%i:%s') AS confirmedAt,
              DATE_FORMAT(s.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,s.remark
            FROM reconciliation_statement s WHERE s.enterprise_id=:enterpriseId ORDER BY s.id DESC
            """).param("enterpriseId", enterpriseId()).query().listOfRows();
    }

    @GetMapping("/statements/{id}/orders")
    List<Map<String, Object>> statementOrders(@PathVariable long id) {
        authorization.require("finance:view");
        requireStatement(id);
        return jdbc.sql("""
            SELECT o.id,o.order_no AS orderNo,u.real_name AS buyerName,so.payable_amount AS payableAmount,
              o.payment_status AS paymentStatus,DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
            FROM reconciliation_statement_order so JOIN order_main o ON o.id=so.order_main_id
            JOIN enterprise_user u ON u.id=o.user_id WHERE so.statement_id=:id ORDER BY o.id
            """).param("id", id).query().listOfRows();
    }

    @PostMapping("/statements")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    Map<String, Object> generateStatement(@Valid @RequestBody StatementRequest request) {
        authorization.require("finance:manage");
        if (request.periodEnd().isBefore(request.periodStart())) throw new IllegalArgumentException("结束日期不能早于开始日期");
        if (request.periodStart().plusMonths(3).isBefore(request.periodEnd())) throw new IllegalArgumentException("单次对账期间不能超过3个月");
        var totals = jdbc.sql("""
            SELECT COUNT(*) AS orderCount,COALESCE(SUM(o.item_amount),0) AS itemAmount,
              COALESCE(SUM(o.freight_amount),0) AS freightAmount,COALESCE(SUM(o.payable_amount),0) AS payableAmount,
              COALESCE(SUM(CASE WHEN o.payment_status=2 THEN o.payable_amount ELSE 0 END),0) AS paidAmount
            FROM order_main o LEFT JOIN reconciliation_statement_order so ON so.order_main_id=o.id
            WHERE o.enterprise_id=:enterpriseId AND o.order_status<>4 AND so.order_main_id IS NULL
              AND DATE(o.created_at) BETWEEN :periodStart AND :periodEnd
            """).param("enterpriseId", enterpriseId()).param("periodStart", request.periodStart())
            .param("periodEnd", request.periodEnd()).query().singleRow();
        if (((Number) totals.get("orderCount")).intValue() == 0) throw new IllegalArgumentException("该期间没有可生成对账单的订单");
        String statementNo = number("DZ");
        int termDays = jdbc.sql("SELECT payment_term_days FROM enterprise_finance_profile WHERE enterprise_id=:id")
            .param("id", enterpriseId()).query(Integer.class).single();
        LocalDate dueDate = request.periodEnd().plusDays(termDays);
        jdbc.sql("""
            INSERT INTO reconciliation_statement(statement_no,enterprise_id,period_start,period_end,order_count,
              item_amount,freight_amount,payable_amount,paid_amount,status,due_date,generated_by,remark)
            VALUES(:statementNo,:enterpriseId,:periodStart,:periodEnd,:orderCount,:itemAmount,:freightAmount,
              :payableAmount,:paidAmount,1,:dueDate,:userId,:remark)
            """).param("statementNo", statementNo).param("enterpriseId", enterpriseId())
            .param("periodStart", request.periodStart()).param("periodEnd", request.periodEnd())
            .param("orderCount", totals.get("orderCount")).param("itemAmount", totals.get("itemAmount"))
            .param("freightAmount", totals.get("freightAmount")).param("payableAmount", totals.get("payableAmount"))
            .param("paidAmount", totals.get("paidAmount")).param("dueDate", dueDate).param("userId", userId())
            .param("remark", request.remark()).update();
        long statementId = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        jdbc.sql("""
            INSERT INTO reconciliation_statement_order(statement_id,order_main_id,payable_amount)
            SELECT :statementId,o.id,o.payable_amount FROM order_main o
            LEFT JOIN reconciliation_statement_order so ON so.order_main_id=o.id
            WHERE o.enterprise_id=:enterpriseId AND o.order_status<>4 AND so.order_main_id IS NULL
              AND DATE(o.created_at) BETWEEN :periodStart AND :periodEnd
            """).param("statementId", statementId).param("enterpriseId", enterpriseId())
            .param("periodStart", request.periodStart()).param("periodEnd", request.periodEnd()).update();
        return Map.of("id", statementId, "statementNo", statementNo);
    }

    @PostMapping("/statements/{id}/confirm")
    @Transactional
    void confirmStatement(@PathVariable long id) {
        authorization.require("finance:manage");
        int changed = jdbc.sql("""
            UPDATE reconciliation_statement SET status=2,confirmed_by=:userId,confirmed_at=NOW()
            WHERE id=:id AND enterprise_id=:enterpriseId AND status=1
            """).params(Map.of("id", id, "enterpriseId", enterpriseId(), "userId", userId())).update();
        if (changed == 0) throw new IllegalArgumentException("对账单不存在或当前状态不可确认");
    }

    @GetMapping("/invoice-eligible-orders")
    List<Map<String, Object>> invoiceEligibleOrders() {
        authorization.require("finance:view");
        return jdbc.sql("""
            SELECT o.id,o.order_no AS orderNo,o.payable_amount AS payableAmount,
              DATE_FORMAT(o.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
            FROM order_main o LEFT JOIN invoice_application_order ao ON ao.order_main_id=o.id
            WHERE o.enterprise_id=:enterpriseId AND o.payment_status=2 AND o.order_status<>4
              AND ao.order_main_id IS NULL ORDER BY o.id DESC
            """).param("enterpriseId", enterpriseId()).query().listOfRows();
    }

    @GetMapping("/invoice-applications")
    List<Map<String, Object>> invoiceApplications() {
        authorization.require("finance:view");
        return jdbc.sql("""
            SELECT a.id,a.application_no AS applicationNo,a.invoice_title AS invoiceTitle,a.tax_no AS taxNo,
              a.invoice_type AS invoiceType,a.recipient_email AS recipientEmail,a.amount,a.status,
              a.invoice_no AS invoiceNo,a.invoice_file_url AS invoiceFileUrl,a.failure_reason AS failureReason,
              COUNT(ao.order_main_id) AS orderCount,DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
              DATE_FORMAT(a.processed_at,'%Y-%m-%d %H:%i:%s') AS processedAt
            FROM invoice_application a LEFT JOIN invoice_application_order ao ON ao.application_id=a.id
            WHERE a.enterprise_id=:enterpriseId GROUP BY a.id ORDER BY a.id DESC
            """).param("enterpriseId", enterpriseId()).query().listOfRows();
    }

    @PostMapping("/invoice-applications")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    Map<String, Object> applyInvoice(@Valid @RequestBody InvoiceApplicationRequest request) {
        authorization.require("finance:manage");
        List<Map<String, Object>> orders = jdbc.sql("""
            SELECT o.id,o.payable_amount AS payableAmount FROM order_main o
            LEFT JOIN invoice_application_order ao ON ao.order_main_id=o.id
            WHERE o.enterprise_id=:enterpriseId AND o.payment_status=2 AND o.order_status<>4
              AND ao.order_main_id IS NULL AND o.id IN (:orderIds)
            """).param("enterpriseId", enterpriseId()).param("orderIds", request.orderIds()).query().listOfRows();
        if (orders.size() != request.orderIds().stream().distinct().count()) throw new IllegalArgumentException("选中订单存在未付款、已取消或已申请开票的记录");
        BigDecimal amount = orders.stream().map(row -> (BigDecimal) row.get("payableAmount"))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        String applicationNo = number("KP");
        jdbc.sql("""
            INSERT INTO invoice_application(application_no,enterprise_id,applicant_user_id,invoice_title,tax_no,
              invoice_type,recipient_email,amount,status,remark)
            VALUES(:applicationNo,:enterpriseId,:userId,:invoiceTitle,:taxNo,:invoiceType,:recipientEmail,:amount,0,:remark)
            """).param("applicationNo", applicationNo).param("enterpriseId", enterpriseId()).param("userId", userId())
            .param("invoiceTitle", request.invoiceTitle().trim()).param("taxNo", request.taxNo().trim())
            .param("invoiceType", request.invoiceType()).param("recipientEmail", request.recipientEmail())
            .param("amount", amount).param("remark", request.remark()).update();
        long applicationId = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        for (var order : orders) {
            jdbc.sql("INSERT INTO invoice_application_order(application_id,order_main_id,amount) VALUES(:applicationId,:orderId,:amount)")
                .param("applicationId", applicationId).param("orderId", order.get("id"))
                .param("amount", order.get("payableAmount")).update();
        }
        return Map.of("id", applicationId, "applicationNo", applicationNo, "amount", amount);
    }

    private void requireStatement(long id) {
        int count = jdbc.sql("SELECT COUNT(*) FROM reconciliation_statement WHERE id=:id AND enterprise_id=:enterpriseId")
            .params(Map.of("id", id, "enterpriseId", enterpriseId())).query(Integer.class).single();
        if (count == 0) throw new IllegalArgumentException("对账单不存在");
    }

    private String number(String prefix) {
        return prefix + java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
            + ThreadLocalRandom.current().nextInt(1000, 10000);
    }

    private long userId() { return auth.current().userId(); }
    private long enterpriseId() { return auth.current().enterpriseId(); }

    record FinanceProfileRequest(@NotBlank String invoiceTitle, @NotBlank String taxNo,
                                 @NotBlank String invoiceType, @NotBlank @Email String recipientEmail,
                                 @Min(0) @Max(365) int paymentTermDays) {}
    record StatementRequest(@NotNull LocalDate periodStart, @NotNull LocalDate periodEnd, String remark) {}
    record InvoiceApplicationRequest(@NotEmpty List<Long> orderIds, @NotBlank String invoiceTitle,
                                     @NotBlank String taxNo, @NotBlank String invoiceType,
                                     @NotBlank @Email String recipientEmail, String remark) {}
}
