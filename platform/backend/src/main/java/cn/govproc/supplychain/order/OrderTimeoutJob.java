package cn.govproc.supplychain.order;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class OrderTimeoutJob {
    private final JdbcClient jdbc;
    private final OrderInventoryService inventory;
    private final TransactionTemplate transactions;

    public OrderTimeoutJob(JdbcClient jdbc,OrderInventoryService inventory,TransactionTemplate transactions) {
        this.jdbc=jdbc; this.inventory=inventory; this.transactions=transactions;
    }

    @Scheduled(fixedDelayString="${orders.timeout-scan-ms:300000}")
    public void cancelExpiredOrders() {
        List<Long> ids=jdbc.sql("""
            SELECT id FROM order_main WHERE order_status=0 AND payment_status=0
              AND payment_due_at<NOW() ORDER BY id LIMIT 100
            """).query(Long.class).list();
        ids.forEach(id->transactions.executeWithoutResult(status->cancelOne(id)));
    }

    private void cancelOne(long id) {
        int changed=jdbc.sql("""
            UPDATE order_main SET order_status=4 WHERE id=:id AND order_status=0
              AND payment_status=0 AND payment_due_at<NOW()
            """).param("id",id).update();
        if(changed==0) return;
        inventory.releaseReserved(id);
        jdbc.sql("""
            INSERT INTO order_event(order_main_id,event_type,from_status,to_status,description,operator_type)
            VALUES(:id,'ORDER_TIMEOUT',0,4,'超过付款期限，系统自动取消订单','SYSTEM')
            """).param("id",id).update();
    }
}
