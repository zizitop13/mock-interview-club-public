---
id: sql-postgresql-upsert-deadlock-key-order
status: draft
---

## Question

Two workers apply the same logical batch in opposite key order. Each statement succeeds alone, but concurrent runs sometimes fail with SQLSTATE 40P01. What is the best explanation and fix?

```sql
-- Worker 1
BEGIN;
INSERT INTO account_totals VALUES (1, 10)
ON CONFLICT (account_id) DO UPDATE
SET total = account_totals.total + EXCLUDED.total;
INSERT INTO account_totals VALUES (2, 20)
ON CONFLICT (account_id) DO UPDATE
SET total = account_totals.total + EXCLUDED.total;

-- Worker 2 executes the same two UPSERTs in order: 2, then 1.
```

## Answers

a. Increase deadlock_timeout so both transactions can wait longer and eventually commit.
b. Use READ UNCOMMITTED so unique-index conflict checks stop acquiring row-level locks.
c. Replace each UPSERT with SELECT then INSERT to avoid concurrent unique-index locking.
d. Sort account keys before every UPSERT and retry the whole transaction on SQLSTATE 40P01.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

Each transaction locks one conflicting row, then waits for the row held by the other, forming a cycle. Use one global key order and retry the whole aborted transaction on SQLSTATE 40P01.

</details>
