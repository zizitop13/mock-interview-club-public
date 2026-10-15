---
id: concurrency-merchant-capture-hedged-idempotency
status: draft
---

## Question

A merchant service hedges slow HTTP capture requests against an idempotent processor. Which smallest change preserves at-most-once capture when both attempts succeed?

```java
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

public final class HedgedCaptureService {
    private final Processor processor;

    public HedgedCaptureService(Processor processor) {
        this.processor = processor;
    }

    public CompletableFuture<Receipt> capture(Payment payment) {
        CompletableFuture<Receipt> primary =
                processor.capture(payment, UUID.randomUUID().toString());

        CompletableFuture<Receipt> hedge = CompletableFuture
                .runAsync(() -> {}, CompletableFuture.delayedExecutor(
                        100, TimeUnit.MILLISECONDS))
                .thenCompose(ignored -> processor.capture(
                        payment, UUID.randomUUID().toString()));

        return primary.applyToEither(hedge, Function.identity());
    }

    public record Payment(String paymentId, long cents) {}
    public record Receipt(String captureId) {}

    public interface Processor {
        // Same key means one capture and stable replay; different keys are independent.
        // Cancellation need not stop a request already accepted remotely.
        CompletableFuture<Receipt> capture(Payment payment, String idempotencyKey);
    }
}
```

## Answers

a. Cancel the primary before starting the hedge and keep independently generated keys.
b. Accept one idempotency key for the request and reuse it for primary and hedge.
c. Keep separate keys but synchronize creation of both HTTP request futures.
d. Replace the delayed executor with a virtual-thread-per-task executor.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

The two successful HTTP calls use different idempotency keys, so the processor may capture twice. Reuse one request-scoped key across primary and hedge; racing responses alone do not cancel remote effects.

</details>
