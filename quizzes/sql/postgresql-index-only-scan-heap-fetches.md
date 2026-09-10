---
id: sql-postgresql-index-only-scan-heap-fetches
status: published
---

## Question

A covering index changed this query to `Index Only Scan`, but under frequent updates `Heap Fetches` stays close to returned rows and latency barely improves. What best explains this behavior and the appropriate response?

```sql
CREATE INDEX orders_customer_created_cover
    ON orders (customer_id, created_at DESC)
    INCLUDE (total_amount, status);

EXPLAIN (ANALYZE, BUFFERS)
SELECT created_at, total_amount, status
FROM orders
WHERE customer_id = 42
ORDER BY created_at DESC
LIMIT 100;

-- Index Only Scan using orders_customer_created_cover
--   Heap Fetches: 96
```

## Answers

a. Included columns live only in heap tuples, so replace `INCLUDE` with ordinary index key columns.

b. The planner cached the plan before updates, so run `DISCARD PLANS` after every update batch.

c. Updated pages lose all-visible bits, forcing heap checks; tune vacuum or reduce churn.

d. `LIMIT` forces heap reads to confirm ordering, so remove it and sort every matching index entry.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

Indexes do not store MVCC visibility. Updates clear heap pages' all-visible bits, so the scan checks heap tuples. Vacuum can restore those bits, but heavy churn may erase the expected benefit.

</details>
