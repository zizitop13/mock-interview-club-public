---
id: sql-postgresql-repeatable-read-write-skew
status: draft
---

## Question

At least one doctor must remain on call. Two doctors run this transaction concurrently under PostgreSQL REPEATABLE READ. How can both commits succeed and violate the rule?

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

SELECT count(*)
FROM doctors
WHERE shift_id = :shift_id
  AND on_call = true;

-- If the count is greater than 1:
UPDATE doctors
SET on_call = false
WHERE id = :my_doctor_id;

COMMIT;
```

## Answers

a. COUNT ignores rows updated after BEGIN, even when the two updates target the same doctor row.
b. Each doctor row lacks a version column, so PostgreSQL cannot detect concurrent row updates.
c. Both snapshots see two doctors, while the transactions update different rows and do not conflict.
d. REPEATABLE READ releases predicate locks before UPDATE, letting transactions overwrite rows.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

This is write skew: both snapshots satisfy the invariant, then each transaction changes a different row. PostgreSQL REPEATABLE READ does not detect that cross-row dependency.

</details>
