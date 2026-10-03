# Sharing one deadline across payment capture retries

## Correct answer

b. Compute one `nanoTime` deadline and pass each attempt only its positive remaining time.

## Detailed explanation

The business invariant is: one capture call must allocate at most its single 300 ms end-to-end time budget across all processor attempts. The processor attempts are explicitly idempotent, so replay safety is not the missing boundary in this scenario.

The original loop restarts `REQUEST_TIMEOUT` for every attempt. If each attempt consumes its full allowance before throwing `TimeoutException`, three sequential attempts can occupy about 900 ms, excluding small scheduling overhead. Each processor call respects the timeout it receives, yet the capture operation violates its own deadline because the attempts do not share a budget.

Create one deadline from the monotonic `System.nanoTime()` clock before the loop. Before every attempt, subtract the current monotonic time from that deadline. Pass only the positive remainder to the processor and stop when nothing remains. A retry that begins after an earlier attempt consumed 220 ms can then receive at most roughly 80 ms, not a fresh 300 ms.

`System.nanoTime()` is appropriate for elapsed-time calculations because wall-clock adjustments do not move it backward or forward. The usual subtraction-based comparison also remains valid across its wraparound for intervals vastly shorter than half its range.

## Code example

```java
import java.time.Duration;
import java.util.concurrent.TimeoutException;

public String capture(String paymentId) throws TimeoutException {
    long deadline = System.nanoTime() + REQUEST_TIMEOUT.toNanos();

    for (int attempt = 0; attempt < 3; attempt++) {
        long remaining = deadline - System.nanoTime();
        if (remaining <= 0) {
            break;
        }

        try {
            return processor.capture(
                paymentId,
                Duration.ofNanos(remaining));
        } catch (TimeoutException ignored) {
            // The next attempt recomputes the remaining shared budget.
        }
    }

    throw new TimeoutException("capture deadline exceeded");
}
```

This assumes the processor enforces the supplied timeout, as stated in the question. If an I/O client can remain blocked beyond it, that client also needs a real connection, request, or read timeout; an outer timer alone cannot release the occupied resource.

The runnable proof uses a fake monotonic clock and an idempotent processor that deterministically consumes time before timing out. The unsafe method makes three attempts with fresh 300 ms allowances and consumes 600 ms. A separate green test proves that the deadline-based method supplies 300 ms and then only 100 ms, stopping at exactly the 300 ms budget.

## Why the other options are incorrect

- a. Cancelling one attempt does not make the next attempt inherit the request's already-consumed time.
- c. A new 300 ms wrapper per attempt repeats the same deadline-reset bug at a different API layer.
- d. Parallel hedging changes retry semantics and multiplies downstream load; it is excessive for this requirement.
