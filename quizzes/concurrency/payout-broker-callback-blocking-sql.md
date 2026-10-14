---
id: concurrency-payout-broker-callback-blocking-sql
status: published
---

## Question

A payout service publishes records asynchronously and audits acknowledgements in SQL. Which smallest change isolates blocking audit I/O without using shared workers or serializing sends?

```java
import java.util.List;
import java.util.concurrent.CompletableFuture;

public final class PayoutPublisher {
    private final Broker broker;
    private final AuditStore audit;

    public PayoutPublisher(Broker broker, AuditStore audit) {
        this.broker = broker;
        this.audit = audit;
    }

    // payouts is a bounded batch; send is nonblocking.
    public CompletableFuture<Void> publish(List<Payout> payouts) {
        CompletableFuture<?>[] completions = payouts.stream()
                .map(payout -> broker.send(payout)
                        .thenAccept(ack -> audit.save(
                                payout.id(), ack.offset())))
                .toArray(CompletableFuture<?>[]::new);
        return CompletableFuture.allOf(completions);
    }

    public record Payout(String id, long cents) {}
    public record Ack(long offset) {}

    public interface Broker {
        // Incomplete futures are completed by one broker I/O thread.
        CompletableFuture<Ack> send(Payout payout);
    }

    public interface AuditStore {
        // A thread-safe blocking SQL write.
        void save(String payoutId, long offset);
    }
}
```

## Answers

a. Run each audit with `thenAcceptAsync` on an owned virtual-thread executor.
b. Replace the stream with `parallelStream` and keep non-async `thenAccept`.
c. Use no-argument `thenAcceptAsync`, sharing the common pool with other work.
d. Join each send before submitting the next payout so callbacks cannot overlap.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

`thenAccept` runs on the broker thread completing the future, so blocking SQL stalls acknowledgements. Offload that stage to an owned virtual-thread executor.

</details>
