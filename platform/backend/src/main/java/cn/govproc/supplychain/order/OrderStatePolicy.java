package cn.govproc.supplychain.order;

public final class OrderStatePolicy {
    public static final int ORDER_PENDING_PAYMENT = 0;
    public static final int ORDER_PENDING_SHIPMENT = 1;
    public static final int ORDER_IN_TRANSIT = 2;
    public static final int ORDER_COMPLETED = 3;
    public static final int ORDER_CANCELLED = 4;
    public static final int ORDER_PARTIALLY_SHIPPED = 5;

    public static final int ITEM_PENDING = 0;
    public static final int ITEM_SHIPPED = 1;
    public static final int ITEM_IN_TRANSIT = 2;
    public static final int ITEM_DELIVERED = 3;
    public static final int ITEM_CANCELLED = 4;

    private OrderStatePolicy() {}

    public static boolean canTransitionItem(int current, int target) {
        if (current < ITEM_PENDING || current > ITEM_CANCELLED
            || target < ITEM_PENDING || target > ITEM_CANCELLED) return false;
        if (current == target) return true;
        return switch (current) {
            case ITEM_PENDING -> target == ITEM_SHIPPED || target == ITEM_IN_TRANSIT || target == ITEM_CANCELLED;
            case ITEM_SHIPPED -> target == ITEM_IN_TRANSIT || target == ITEM_DELIVERED;
            case ITEM_IN_TRANSIT -> target == ITEM_DELIVERED;
            default -> false;
        };
    }

    public static int deriveOrderStatus(int total, int pending, int shippedOrTransit,
                                        int delivered, int cancelled) {
        if (total <= 0 || pending < 0 || shippedOrTransit < 0 || delivered < 0 || cancelled < 0
            || pending + shippedOrTransit + delivered + cancelled != total) {
            throw new IllegalArgumentException("Invalid fulfillment counters");
        }
        int active = total - cancelled;
        if (active == 0) return ORDER_CANCELLED;
        if (delivered == active) return ORDER_COMPLETED;
        if (pending == active) return ORDER_PENDING_SHIPMENT;
        if (pending > 0) return ORDER_PARTIALLY_SHIPPED;
        return ORDER_IN_TRANSIT;
    }
}
