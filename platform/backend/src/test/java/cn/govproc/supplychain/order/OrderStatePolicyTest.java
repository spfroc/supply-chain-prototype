package cn.govproc.supplychain.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class OrderStatePolicyTest {
    @Test
    void itemStatusOnlyMovesForwardThroughValidBusinessSteps() {
        assertThat(OrderStatePolicy.canTransitionItem(0, 1)).isTrue();
        assertThat(OrderStatePolicy.canTransitionItem(0, 2)).isTrue();
        assertThat(OrderStatePolicy.canTransitionItem(0, 4)).isTrue();
        assertThat(OrderStatePolicy.canTransitionItem(0, 3)).isFalse();
        assertThat(OrderStatePolicy.canTransitionItem(2, 3)).isTrue();
        assertThat(OrderStatePolicy.canTransitionItem(3, 2)).isFalse();
        assertThat(OrderStatePolicy.canTransitionItem(4, 1)).isFalse();
    }

    @Test
    void derivesAggregateStatusIncludingCancelledLines() {
        assertThat(OrderStatePolicy.deriveOrderStatus(3, 3, 0, 0, 0)).isEqualTo(1);
        assertThat(OrderStatePolicy.deriveOrderStatus(3, 2, 1, 0, 0)).isEqualTo(5);
        assertThat(OrderStatePolicy.deriveOrderStatus(3, 0, 2, 0, 1)).isEqualTo(2);
        assertThat(OrderStatePolicy.deriveOrderStatus(3, 0, 0, 2, 1)).isEqualTo(3);
        assertThat(OrderStatePolicy.deriveOrderStatus(2, 0, 0, 0, 2)).isEqualTo(4);
    }

    @Test
    void rejectsInconsistentCounters() {
        assertThatThrownBy(() -> OrderStatePolicy.deriveOrderStatus(2, 1, 1, 1, 0))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
