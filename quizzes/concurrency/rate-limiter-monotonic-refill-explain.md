# Measuring rate-limit refills with a monotonic clock

## Correct answer

b. Measure elapsed periods with `System.nanoTime()` and nanosecond units.

## Detailed explanation

The business invariant is that the token budget advances only as real elapsed duration passes. A civil-clock correction must neither create an early refill nor postpone a refill that is due.

`System.currentTimeMillis()` reports wall-clock time. An administrator, time synchronization, a virtual-machine clock correction, or another clock adjustment can move it forward or backward. A forward jump makes the original code calculate refill periods that did not actually elapse, so it can admit excess requests. A backward jump can make `periods` negative and delay refills until wall time catches up.

The synchronized method already makes each refill-and-consume transition atomic for this one limiter instance. The missing boundary is therefore not mutual exclusion; it is choosing a time source whose contract matches elapsed-time measurement.

`System.nanoTime()` is monotonic and intended for measuring durations. Its absolute value has no business meaning, so the code must subtract two readings and use consistent nanosecond units. Advancing `lastRefillNanos` by whole periods also retains the fractional remainder rather than drifting the refill schedule.

## Code example

```java
import java.util.concurrent.TimeUnit;

private static final long REFILL_PERIOD_NANOS =
    TimeUnit.MILLISECONDS.toNanos(100);

private long lastRefillNanos = System.nanoTime();

public synchronized boolean allow() {
    long now = System.nanoTime();
    long periods = (now - lastRefillNanos) / REFILL_PERIOD_NANOS;

    if (periods > 0) {
        tokens = (int) Math.min(capacity, tokens + periods);
        lastRefillNanos += periods * REFILL_PERIOD_NANOS;
    }

    if (tokens == 0) return false;
    tokens--;
    return true;
}
```

This change protects the elapsed-time invariant for an in-memory limiter. If several processes must share one quota, a separate distributed correctness boundary would be required, but that is outside this single-instance scenario.

## Why the other options are incorrect

- a. An `AtomicLong` can make a token count atomic, but it does not stop the wall clock from jumping; replacing the existing monitor also complicates the compound refill-and-consume transition.
- c. `LongAdder` is designed for scalable statistics, not an exact admission budget, and retaining the wall-clock timestamp leaves the timing defect unchanged.
- d. Two wall-clock reads can both jump or be corrected; choosing the later reading does not give the monotonic elapsed-time contract the limiter needs.
