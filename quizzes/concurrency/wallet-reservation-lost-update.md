---
id: concurrency-wallet-reservation-lost-update
status: published
---

## Question

A wallet service reserves funds before payment capture. In one authoritative JVM, which change prevents successful reservations from exceeding a wallet's funds without one global lock?

```java
import java.util.concurrent.ConcurrentHashMap;

public final class WalletReservations {
    private final ConcurrentHashMap<String, Long> available =
        new ConcurrentHashMap<>();

    public void open(String walletId, long cents) {
        if (cents < 0 || available.putIfAbsent(walletId, cents) != null) {
            throw new IllegalArgumentException("invalid wallet");
        }
    }

    public boolean reserve(String walletId, long cents) {
        if (cents <= 0) {
            throw new IllegalArgumentException("invalid amount");
        }

        long current = available.getOrDefault(walletId, 0L);
        if (current < cents) {
            return false;
        }

        available.put(walletId, current - cents);
        return true;
    }
}
```

## Answers

a. Use `available.compute` to check and subtract atomically for each wallet key.
b. Wrap the map with `Collections.synchronizedMap` and leave `reserve` unchanged.
c. Store `AtomicLong` balances but use `get` followed by `addAndGet` per reservation.
d. Synchronize `reserve` so every wallet shares one application-wide monitor.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

The separate read, check, and write lose a concurrent reservation. `compute` makes that decision atomic per wallet, protecting the rule that successful reservations cannot exceed its funds.

</details>
