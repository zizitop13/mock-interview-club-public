---
id: concurrency-merchant-capture-deadline-budget
status: published
---

## Question

A merchant capture uses idempotent processor attempts and has a 300 ms end-to-end deadline. What should change so sequential retries share that deadline?

```java
import java.time.Duration;
import java.util.concurrent.TimeoutException;

public final class MerchantCapture {
    private static final Duration REQUEST_TIMEOUT =
        Duration.ofMillis(300);

    private final Processor processor;

    public MerchantCapture(Processor processor) {
        this.processor = processor;
    }

    public String capture(String paymentId) throws TimeoutException {
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                return processor.capture(paymentId, REQUEST_TIMEOUT);
            } catch (TimeoutException ignored) {
                // Retry the same idempotency key.
            }
        }
        throw new TimeoutException("capture deadline exceeded");
    }

    public interface Processor {
        String capture(String paymentId, Duration timeout)
            throws TimeoutException;
    }
}
```

## Answers

a. Cancel each timed-out attempt, but give the next attempt the full 300 ms again.
b. Compute one `nanoTime` deadline and pass each attempt only its positive remaining time.
c. Apply a separate 300 ms `orTimeout` to every attempt without changing the loop.
d. Run all three attempts concurrently and return the first successful capture.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

Three independent 300 ms budgets can outlive the request deadline. One monotonic deadline makes every retry consume the same remaining budget and stops retries when it reaches zero.

</details>
