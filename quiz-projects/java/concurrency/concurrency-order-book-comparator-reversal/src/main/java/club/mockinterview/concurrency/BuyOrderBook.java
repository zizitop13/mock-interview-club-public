package club.mockinterview.concurrency;

import java.util.Comparator;
import java.util.Objects;
import java.util.concurrent.PriorityBlockingQueue;

public final class BuyOrderBook {
    private static final Comparator<Order> WHOLE_CHAIN_REVERSED =
            Comparator.comparingLong(Order::priceMicros)
                    .thenComparingLong(Order::sequence)
                    .reversed();

    private static final Comparator<Order> PRICE_TIME_PRIORITY =
            Comparator.comparingLong(Order::priceMicros)
                    .reversed()
                    .thenComparingLong(Order::sequence);

    private final PriorityBlockingQueue<Order> orders;

    public BuyOrderBook() {
        this(WHOLE_CHAIN_REVERSED);
    }

    private BuyOrderBook(Comparator<Order> priority) {
        orders = new PriorityBlockingQueue<>(64, priority);
    }

    public static BuyOrderBook withPriceTimePriority() {
        return new BuyOrderBook(PRICE_TIME_PRIORITY);
    }

    public void submit(Order order) {
        orders.add(Objects.requireNonNull(order));
    }

    public Order next() {
        return orders.poll();
    }

    public record Order(String orderId, long priceMicros, long sequence) {
        public Order {
            Objects.requireNonNull(orderId);
        }
    }
}
