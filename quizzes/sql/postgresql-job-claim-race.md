---
id: sql-postgresql-job-claim-race
status: published
---

## Question

Two PostgreSQL workers run this transaction at READ COMMITTED, then execute the selected job. Why can both execute the same job?

```sql
BEGIN;

SELECT id
FROM jobs
WHERE status = 'READY'
ORDER BY created_at
LIMIT 1;

UPDATE jobs
SET status = 'PROCESSING', worker_id = :worker_id
WHERE id = :selected_id;

COMMIT;
```

## Answers

a. ORDER BY may return different rows unless created_at has a unique index.
b. Both SELECT statements may see READY before either worker commits its UPDATE.
c. READ COMMITTED releases the UPDATE row lock before the transaction commits.
d. PostgreSQL can roll back one UPDATE but still commit both workers' SELECT results.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

A plain SELECT does not claim the row. Both transactions can select it while it is READY; one UPDATE waits, then overwrites the first worker's claim and executes the same job.

</details>
