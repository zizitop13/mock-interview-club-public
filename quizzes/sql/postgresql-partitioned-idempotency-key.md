---
id: sql-postgresql-partitioned-idempotency-key
status: draft
---

## Question

A payments table is partitioned by day for retention. The team also needs each idempotency key to be unique across all days. Why does this constraint fail, and which design preserves both requirements?

```sql
CREATE TABLE payments (
    payment_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    created_at date NOT NULL,
    amount numeric(12, 2) NOT NULL
) PARTITION BY RANGE (created_at);

ALTER TABLE payments
    ADD CONSTRAINT payments_idempotency_key UNIQUE (idempotency_key);
```

## Answers

a. Include created_at in the unique key; that still rejects the same key on different days.
b. Create the unique index on every partition; PostgreSQL checks all partitions before inserting.
c. Take an advisory lock for the key; the lock permanently records every successful payment.
d. Claim the key in an unpartitioned registry, then insert the payment in the same transaction.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

PostgreSQL requires a partitioned unique constraint to include every partition key. A separate registry with a primary key provides global uniqueness while the payment rows remain date-partitioned.

</details>
