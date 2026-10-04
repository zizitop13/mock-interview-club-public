# Keeping concurrent trading quote publication monotonic

## Correct answer

d. Use `accumulateAndGet` with a pure function that keeps the higher-sequence quote.

## Detailed explanation

The business invariant is: after any set of completed `publish` calls, the cache must retain the complete quote with the highest source sequence it has seen.

`AtomicReference.set` atomically and safely publishes one reference, but it does not understand this ordering rule. A refresh for sequence 41 can start first and finish slowly. A refresh for sequence 42 can publish, after which the delayed sequence 41 refresh can call `set` and replace it. Readers then observe a stale but internally valid quote.

`accumulateAndGet` performs a retrying atomic update. Its pure accumulator compares the currently stored snapshot with the incoming snapshot and returns whichever has the higher sequence. If another publisher changes the reference during the operation, `AtomicReference` retries the comparison against the newer state. A delayed older quote therefore cannot move the cache backward, while a newer one is not silently lost after one failed CAS.

Every quote is a complete snapshot and sequences are globally comparable under the stated assumptions. The cache may safely skip an intermediate sequence; unlike a delta-based CQRS projection, it does not need to buffer gaps before applying a later snapshot.

## Code example

```java
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

public final class TradingQuoteCache {
    private final AtomicReference<Quote> latest =
        new AtomicReference<>(new Quote(0, 0));

    public void publish(Quote incoming) {
        Objects.requireNonNull(incoming);
        latest.accumulateAndGet(incoming, (stored, candidate) ->
            candidate.sequence() > stored.sequence()
                ? candidate
                : stored);
    }

    public Quote current() {
        return latest.get();
    }

    public record Quote(long sequence, long priceMicros) {}
}
```

The comparison function has no external side effects because an atomic update function may be evaluated more than once under contention.

The runnable proof pauses an older refresh, publishes a newer quote, then releases the older refresh and verifies that unconditional `set` regresses the cache. A separate green test starts both atomic publications together and verifies that the highest sequence remains regardless of their execution order.

## Why the other options are incorrect

- a. `AtomicReference` already supplies volatile-style visibility; adding `volatile` does not enforce sequence order.
- b. A monitor serializes method bodies, but an older refresh may acquire it after the newer refresh and still overwrite it.
- c. A one-shot CAS can lose the highest incoming quote when interference makes that single attempt fail.
