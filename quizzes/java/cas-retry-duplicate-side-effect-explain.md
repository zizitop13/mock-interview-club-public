# CAS retries and duplicate side effects

## Correct answer

b. A failed CAS retries the loop and can repeat the notification before one debit succeeds.

## Detailed explanation

The compare-and-set loop is an optimistic atomic update. Each iteration reads a balance, computes a replacement, and installs it only if no competing thread changed the observed value. This protects the balance from lost updates without a lock.

It does not make the entire loop execute once. Suppose two threads both read 100. Each calls `debitStarted(10)`. One changes the balance to 90. The other CAS fails because its expected value is stale, loops, reads 90, calls the notification service again, and may then successfully change the balance to 80. Two debits occurred, but three notifications were sent.

A CAS loop may repeat its body any number of times under contention. Code before the successful CAS must therefore be free of externally visible side effects, or those effects must be safe to repeat. Move the notification after the successful CAS if a best-effort notification is acceptable. If the balance change and notification must be reliably coupled, persist an outbox event in the same durable transaction as the balance update and publish it idempotently.

## Code example

```java
final class Account {
    private final AtomicLong balance;
    private final Notifications notifications;

    Account(long openingBalance, Notifications notifications) {
        this.balance = new AtomicLong(openingBalance);
        this.notifications = notifications;
    }

    boolean debit(long amount) {
        while (true) {
            long current = balance.get();
            if (current < amount) {
                return false;
            }

            if (balance.compareAndSet(current, current - amount)) {
                notifications.debitCompleted(amount);
                return true;
            }
        }
    }
}
```

This version performs the in-memory state transition first, so CAS retries have no external effect. It still cannot guarantee delivery if the process fails after the CAS but before the notification; durable financial workflows normally use transactional storage plus an outbox rather than only an `AtomicLong`.

## Why the other options are incorrect

- a. AtomicLong reads and writes are atomic, so a `long` value obtained through `get()` is not torn. Competing threads can read the same value, but CAS prevents both stale updates from succeeding.
- c. `compareAndSet(expected, update)` returns true when it performs that update and false when the current value does not match the expected value. Another thread merely reading the value cannot reverse that result.
- d. The notification call does not coordinate the two atomic updates. For the same expected balance, at most one CAS can succeed; the bug is that the losing thread already performed the side effect before retrying.
