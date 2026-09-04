package cn.govproc.supplychain.business;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.web.client.RestClient;

class CollectJobStopTest {
    @Test
    void repeatedStopDoesNotRewriteCompletedItemsOrDispatchWork() {
        JdbcClient jdbc = mock(JdbcClient.class, RETURNS_DEEP_STUBS);
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        when(jdbc.sql(anyString()).param(eq("id"), eq(7L)).update()).thenReturn(0);
        JdbcClient.StatementSpec jobQuery = mock(JdbcClient.StatementSpec.class, RETURNS_DEEP_STUBS);
        when(jdbc.sql(contains("WHERE j.id=:id"))).thenReturn(jobQuery);
        when(jobQuery.param("id", 7L).query().listOfRows())
            .thenReturn(List.of(Map.of("id", 7L, "status", "CANCELLED")));
        JdbcClient.StatementSpec itemQuery = mock(JdbcClient.StatementSpec.class, RETURNS_DEEP_STUBS);
        when(jdbc.sql(contains("WHERE i.job_id=:id ORDER BY"))).thenReturn(itemQuery);
        when(itemQuery.param("id", 7L).query().listOfRows())
            .thenReturn(List.of());
        RestClient collector = mock(RestClient.class);
        CollectJobService service = new CollectJobService(jdbc, collector,
            command -> { throw new AssertionError("Stop must not enqueue work"); }, manager, "http://collector");
        assertThat(service.stop(7L).get("status")).isEqualTo("CANCELLED");
        verifyNoInteractions(collector);
        verify(manager).commit(any());
    }
}
