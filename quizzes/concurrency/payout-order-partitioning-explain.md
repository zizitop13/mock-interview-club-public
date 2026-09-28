# Preserving payout order with keyed executor partitions

## Correct answer

c. Hash each merchant ID to one of several single-thread executors and submit there.

## Detailed explanation

The business invariant is: for one merchant, payout sequence `n + 1` must not reach the bank until sequence `n` has finished. The caller already invokes `submit` serially in the accepted order, so the missing boundary is inside the dispatcher.

A fixed thread pool uses several workers. Even when tasks enter its queue in order, different workers may execute two payouts for the same merchant concurrently. The later payout can call the bank or finish first, violating the merchant's ordering guarantee.

Route every merchant deterministically to one of a fixed number of single-thread executors. Payouts for the same merchant always enter the same FIFO queue and execute one at a time. Different partitions execute concurrently, so the design retains bounded throughput without creating an executor or thread for every merchant.

Hash collisions only serialize some unrelated merchants; they do not break correctness. Choose the partition count from measured workload and downstream capacity. If submission occurs concurrently, establish the merchant sequence before this dispatcher or serialize enqueueing by the same business key; the quiz explicitly states that the caller submits serially in accepted order.

## Code example

```java
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;

public final class PayoutDispatcher implements AutoCloseable {
    private final Bank bank;
    private final List<ExecutorService> partitions;

    public PayoutDispatcher(Bank bank, int partitionCount) {
        if (partitionCount <= 0) {
            throw new IllegalArgumentException("partitionCount must be positive");
        }
        this.bank = bank;
        this.partitions = IntStream.range(0, partitionCount)
            .mapToObj(ignored -> Executors.newSingleThreadExecutor())
            .toList();
    }

    public Future<?> submit(Payout payout) {
        int partition = Math.floorMod(
            payout.merchantId().hashCode(), partitions.size());
        return partitions.get(partition)
            .submit(() -> bank.send(payout));
    }

    @Override
    public void close() {
        partitions.forEach(ExecutorService::shutdown);
    }
}
```

The runnable proof serially submits two payouts for one merchant to a two-worker shared pool and forces the later payout to finish first. Its fix test verifies same-merchant order while two merchants execute concurrently on different partitions.

## Why the other options are incorrect

- a. One global single-thread executor preserves order, but it unnecessarily serializes independent merchants and fails the stated bounded-concurrency requirement.
- b. A monitor serializes calls but does not guarantee that competing worker threads acquire it in submission order; it also creates a global bottleneck.
- d. Work stealing is designed to distribute independent tasks, not preserve business-key order, so same-merchant payouts can still overlap or overtake one another.
