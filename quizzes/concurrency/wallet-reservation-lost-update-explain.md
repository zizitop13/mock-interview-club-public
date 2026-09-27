# Protecting wallet reservations from lost updates

## Correct answer

a. Use `available.compute` to check and subtract atomically for each wallet key.

## Detailed explanation

The business invariant is: for one wallet, the sum of successful reservations must never exceed the funds opened for that wallet. `ConcurrentHashMap` makes each individual `get` and `put` thread-safe, but it does not make the whole read-check-write sequence atomic.

Suppose a wallet has 100 cents and two threads each reserve 60 cents. Both can read 100, both can pass the funds check, and both can store 40. Both calls return `true`, so the service has confirmed 120 cents of reservations against 100 cents even though the remaining value still looks nonnegative. This is a lost update caused by a check-then-act race.

`ConcurrentHashMap.compute` runs the remapping operation atomically for the selected key. Keeping the balance check and subtraction inside that operation means the second reservation observes the result of the first. It does not impose one application-wide monitor, so reservations for unrelated wallet keys are not deliberately serialized behind a single lock.

The stated one-authoritative-JVM assumption is important. If several processes could reserve the same wallet, the correctness boundary would need to move to a shared transactional store or another cross-process serialization mechanism.

## Code example

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

public final class WalletReservations {
    private final ConcurrentHashMap<String, Long> available =
        new ConcurrentHashMap<>();

    public boolean reserve(String walletId, long cents) {
        if (cents <= 0) {
            throw new IllegalArgumentException("invalid amount");
        }

        AtomicBoolean reserved = new AtomicBoolean();
        available.compute(walletId, (id, current) -> {
            if (current == null || current < cents) {
                return current;
            }
            reserved.set(true);
            return current - cents;
        });
        return reserved.get();
    }
}
```

The runnable proof forces two unsafe calls to read the same 100-cent balance before either writes, and verifies that both incorrectly succeed. A separate green test runs the `compute` implementation concurrently and verifies that exactly one 60-cent reservation succeeds and 40 cents remain.

## Why the other options are incorrect

- b. A synchronized map protects each method call, but the separate `get`, check, and `put` still do not form one atomic operation.
- c. An `AtomicLong` makes each operation atomic, but `get` followed by a conditional `addAndGet` still allows both threads to pass the check and can make the balance negative.
- d. Synchronizing the whole method would protect the invariant inside one JVM, but it serializes reservations for every wallet. The per-key `compute` operation is the simpler production-reasonable boundary for this requirement.
