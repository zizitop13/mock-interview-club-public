---
id: sql-keyset-pagination-timestamp-ties
status: published
---

## Question

Several payments can share `created_at`. Why can this cursor API skip rows at a page boundary, and what is the correct fix?

```sql
SELECT id, created_at, amount
FROM payments
WHERE tenant_id = :tenant_id
  AND (:cursor IS NULL OR created_at < :cursor)
ORDER BY created_at DESC
LIMIT 50;
```

## Answers

a. Use row locks so later page requests retain the result set observed by the first request.
b. Order and cursor by (created_at, id), with a matching composite keyset predicate.
c. Increase timestamp precision while keeping created_at as the only ordering and cursor field.
d. Add OFFSET to the timestamp cursor so tied rows are counted on the following request.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

A timestamp-only cursor cannot identify a position inside a tie. A composite `(created_at, id)` cursor creates a total order and prevents tied rows from being skipped.

</details>
