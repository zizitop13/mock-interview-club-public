---
id: sql-postgresql-partial-index-generic-plan
status: draft
---

## Question

This prepared query is fast initially but may switch to a slow plan after repeated executions. Why can the partial index disappear from the generic plan?

```sql
CREATE INDEX jobs_ready_created_idx
    ON jobs (created_at)
    WHERE status = 'READY';

PREPARE next_jobs(text) AS
SELECT id, created_at
FROM jobs
WHERE status = $1
ORDER BY created_at
LIMIT 100;

EXECUTE next_jobs('READY');
```

## Answers

a. A generic plan cannot prove $1 implies status = 'READY', so it may exclude the partial index.
b. The index stores no created_at values because predicate columns must lead every partial index.
c. PostgreSQL disables indexes after several executions and forces scans for prepared statements.
d. ORDER BY requires status in the index key even though the predicate fixes it to READY.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

A partial index is usable only when the planner can prove the query implies its predicate. A generic plan must work for any $1 value, so it cannot assume $1 is always READY.

</details>
