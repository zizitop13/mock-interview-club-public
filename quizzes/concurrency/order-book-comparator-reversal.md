---
id: concurrency-order-book-comparator-reversal
status: published
---

## Question

After a batch is fully submitted, buy orders match by highest price, then lowest unique exchange sequence. Which comparator change enforces that rule?

```java
import java.util.Comparator;
import java.util.concurrent.PriorityBlockingQueue;

public final class BuyOrderBook {
    private static final Comparator<Order> MATCH_PRIORITY =
        Comparator.comparingLong(Order::priceMicros)
            .thenComparingLong(Order::sequence)
            .reversed();

    private final PriorityBlockingQueue<Order> orders =
        new PriorityBlockingQueue<>(64, MATCH_PRIORITY);

    public void submit(Order order) {
        orders.add(order);
    }

    public Order next() {
        return orders.poll();
    }

    public record Order(String orderId, long priceMicros, long sequence) {}
}
```

## Answers

a. Reverse only the price comparator, then append sequence in ascending order.
b. Keep the comparator and synchronize both queue operations on one monitor.
c. Replace the priority queue with FIFO so submission order determines matching.
d. Compare sequence first, then reverse the whole comparator for descending priority.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

`reversed()` flips the whole comparator chain, so equal-price orders use descending sequence. Reverse price first, then append ascending sequence.

</details>
