---
id: concurrency-payout-order-partitioning
status: draft
---

## Question

A payout service sends merchant transfers to a bank. The caller invokes `submit` serially in accepted order; which change preserves order per merchant with bounded concurrency across merchants?

```java
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public final class PayoutDispatcher implements AutoCloseable {
    private final ExecutorService workers =
        Executors.newFixedThreadPool(8);
    private final Bank bank;

    public PayoutDispatcher(Bank bank) {
        this.bank = bank;
    }

    public Future<?> submit(Payout payout) {
        return workers.submit(() -> bank.send(payout));
    }

    @Override
    public void close() {
        workers.shutdown();
    }

    public record Payout(String merchantId, long sequence, long cents) {}

    public interface Bank {
        void send(Payout payout);
    }
}
```

## Answers

a. Use one global single-thread executor so all payouts follow the caller's submission order.
b. Synchronize `bank.send`; the worker threads will then retain the submission order.
c. Hash each merchant ID to one of several single-thread executors and submit there.
d. Use the common `ForkJoinPool`; its work-stealing queues preserve per-merchant order.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

The shared pool can overlap one merchant's payouts. A stable merchant-to-single-thread partition preserves accepted order while bounded partitions keep cross-merchant concurrency.

</details>
