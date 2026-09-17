---
id: messaging-consumer-inbox-redelivery
status: draft
---

## Question

An at-least-once broker redelivers after a consumer commits its database update but crashes before acknowledgement. No broker/database distributed transaction exists. The event ID must not change the balance twice, while an uncommitted update must be retried. Which design satisfies both?

```java
void on(PaymentCaptured event) {
    jdbc.update(
        "update account set balance = balance + ? where id = ?",
        event.amount(), event.accountId());
    broker.ack(event);
}
```

## Answers

a. Update only after a new unique inbox insert; acknowledge after the DB transaction commits.
b. Update and commit, then acknowledge; depend on partition ordering to suppress replays.
c. Acknowledge first, then retry the database update locally until it commits.
d. Lock by account ID, update and acknowledge, then release the distributed lock.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

A unique inbox insert and business update commit atomically. A replay finds the ID already stored and skips the update; a rollback stores neither, so the broker can safely redeliver.

</details>
