---
id: sql-mysql-instant-ddl-metadata-lock
status: published
---

## Question

A MySQL migration uses `ALGORITHM=INSTANT`, but it waits for minutes while an old transaction that only ran a `SELECT` remains open. Why can this happen?

```sql
-- Session A
START TRANSACTION;
SELECT email FROM customers WHERE id = 42;
-- The connection stays idle without COMMIT or ROLLBACK.

-- Session B
ALTER TABLE customers
    ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false,
    ALGORITHM=INSTANT;
```

## Answers

a. Instant DDL avoids a row rewrite, but ALTER still needs an exclusive metadata lock.
b. MySQL must rewrite every table row before it can request the ALTER metadata lock.
c. The SELECT locks every customer row, so ALTER waits for those row locks to be released.
d. The connection caches the old schema, so only restarting that session can unblock ALTER.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

`ALGORITHM=INSTANT` avoids rebuilding the table, not metadata locking. The open transaction retains a shared metadata lock, so ALTER waits for an exclusive one.

</details>
