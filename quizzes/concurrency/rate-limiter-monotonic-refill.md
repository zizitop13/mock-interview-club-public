---
id: concurrency-rate-limiter-monotonic-refill
status: published
---

## Question

A merchant API uses this in-memory token bucket to absorb short bursts. Which smallest change makes refill timing reliable?

```java
public final class MerchantRateLimiter {
    private static final long REFILL_PERIOD_MILLIS = 100;

    private final int capacity;
    private int tokens;
    private long lastRefillMillis = System.currentTimeMillis();

    public MerchantRateLimiter(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException();
        this.capacity = capacity;
        this.tokens = capacity;
    }

    public synchronized boolean allow() {
        long now = System.currentTimeMillis();
        long periods = (now - lastRefillMillis) / REFILL_PERIOD_MILLIS;

        if (periods > 0) {
            tokens = (int) Math.min(capacity, tokens + periods);
            lastRefillMillis += periods * REFILL_PERIOD_MILLIS;
        }

        if (tokens == 0) return false;
        tokens--;
        return true;
    }
}
```

## Answers

a. Replace the synchronized method with an `AtomicLong` token counter.
b. Measure elapsed periods with `System.nanoTime()` and nanosecond units.
c. Store tokens in a `LongAdder` while retaining the wall-clock timestamp.
d. Read `currentTimeMillis()` twice and keep the later timestamp for refill.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

Wall time can jump, granting tokens early or delaying refill. A monotonic ticker measures elapsed duration; synchronization already protects the state transition.

</details>
