# Preventing duplicate effects after message redelivery

## Correct answer

a. Update only after a new unique inbox insert; acknowledge after the DB transaction commits.

## Detailed explanation

At-least-once delivery necessarily permits the same event to reach a consumer more than once. A crash after the database commit but before broker acknowledgement is the classic uncertainty window: the broker cannot observe the commit, so it must redeliver.

The consumer therefore needs a durable record of which immutable event IDs it has applied. The inbox row and the balance change must commit in the same local database transaction. A unique key on the consumer name and event ID arbitrates both sequential redelivery and concurrent duplicate delivery.

On the first delivery, the inbox insert succeeds and the balance changes. If the process crashes after commit but before acknowledgement, the replay cannot insert the same key and skips the balance change. If the transaction rolls back, neither the marker nor the balance change remains, and the broker can safely retry.

Acknowledgement must happen only after a successful commit. This pattern gives an idempotent business effect without claiming exactly-once message delivery and without a distributed transaction between the broker and database.

```mermaid
sequenceDiagram
    participant B as Broker
    participant C as Consumer
    participant D as Database
    B->>C: PaymentCaptured event-17
    C->>D: begin; insert event-17; update balance; commit
    D-->>C: committed
    C--xB: crash before acknowledgement
    B->>C: redeliver event-17
    C->>D: insert event-17
    D-->>C: duplicate key, no business update
    C-->>B: acknowledge
```

## Code example

```java
@Transactional
public void apply(PaymentCaptured event) {
    int inserted = jdbc.update("""
        insert into consumer_inbox (consumer_name, event_id)
        values ('balance-projector', ?)
        on conflict do nothing
        """, event.eventId());

    if (inserted == 0) {
        return; // This event was already applied.
    }

    jdbc.update("""
        update account
           set balance = balance + ?
         where id = ?
        """, event.amount(), event.accountId());
}
```

The message listener should acknowledge only after `apply` returns and its transaction has committed. The SQL uses a PostgreSQL-style conflict clause; other databases can enforce the same invariant with a unique constraint and equivalent insert handling.

## Why the other options are incorrect

- b. Partition ordering orders deliveries but does not remove duplicates. After the crash, the same event can be delivered again and increment the balance a second time.
- c. A crash after acknowledgement but before the database commit loses the update permanently because the broker now considers the message consumed.
- d. A lock serializes consumers but records no durable completion fact. After the lock is released, a redelivery can acquire it and repeat the already committed update.
