---
id: java-cas-retry-duplicate-side-effect
status: draft
---

## Question

This debit method keeps the balance correct in concurrent tests. Why can customers still receive duplicate debit notifications?

```java
final class Account {
    private final AtomicLong balance;
    private final Notifications notifications;

    boolean debit(long amount) {
        while (true) {
            long current = balance.get();
            if (current < amount) {
                return false;
            }

            notifications.debitStarted(amount);

            if (balance.compareAndSet(current, current - amount)) {
                return true;
            }
        }
    }
}
```

## Answers

a. AtomicLong may expose a torn current value, so the same debit can pass the funds check twice.
b. A failed CAS retries the loop and can repeat the notification before one debit succeeds.
c. compareAndSet may update the balance and still return false when another thread reads it.
d. The notification call establishes ordering that lets both CAS operations succeed from one value.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

CAS safely retries stale balance updates, but everything before it may run again. Under contention, one successful debit can therefore trigger multiple non-idempotent notifications.

</details>
