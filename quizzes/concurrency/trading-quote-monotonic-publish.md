---
id: concurrency-trading-quote-monotonic-publish
status: draft
---

## Question

A trading quote cache publishes complete immutable snapshots from one source with a unique increasing sequence. Which change makes concurrent publishes retain the highest sequence?

```java
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

public final class TradingQuoteCache {
    private final AtomicReference<Quote> latest =
        new AtomicReference<>(new Quote(0, 0));

    public void publish(Quote quote) {
        latest.set(Objects.requireNonNull(quote));
    }

    public Quote current() {
        return latest.get();
    }

    public record Quote(long sequence, long priceMicros) {}
}
```

## Answers

a. Declare the `AtomicReference` field volatile and keep `set` unchanged.
b. Synchronize `publish` but still replace the value without comparing sequences.
c. Compare once and call `compareAndSet` once when the incoming sequence is higher.
d. Use `accumulateAndGet` with a pure function that keeps the higher-sequence quote.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

An atomic `set` can still let a delayed older refresh overwrite a newer quote. The atomic accumulator retries interference and retains the highest complete snapshot.

</details>
