# PostgreSQL partial indexes and generic prepared plans

## Correct answer

a. A generic plan cannot prove $1 implies status = 'READY', so it may exclude the partial index.

## Detailed explanation

A PostgreSQL partial index contains only rows satisfying its predicate. The planner may use it only when it can prove at planning time that the query's conditions imply that predicate. Here the index contains rows where `status = 'READY'`.

A custom plan is built using the parameter values of one execution. With `$1 = 'READY'`, PostgreSQL can see that the query matches the partial-index predicate and may choose `jobs_ready_created_idx`. After several executions, PostgreSQL may compare the average estimated cost of custom plans with a reusable generic plan and choose the generic plan.

The generic plan must be valid for every possible `$1`, including `'DONE'` or `'FAILED'`. Those values do not imply `status = 'READY'`, so the generic plan cannot depend on an index containing only READY rows. It may choose a sequential scan or another broader index, causing the apparent performance change.

The robust fix for an endpoint that always fetches READY jobs is to make the predicate a literal in that SQL shape. If the application genuinely queries several statuses, use separate statement shapes or indexes appropriate to those access patterns. Setting `plan_cache_mode = force_custom_plan` can confirm the diagnosis, but it trades away generic-plan reuse and is usually not the first permanent fix.

## Code example

```sql
-- A fixed-purpose statement exposes the partial-index predicate at plan time.
PREPARE next_ready_jobs AS
SELECT id, created_at
FROM jobs
WHERE status = 'READY'
ORDER BY created_at
LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS)
EXECUTE next_ready_jobs;

-- Diagnostic comparison for the parameterized statement:
SET LOCAL plan_cache_mode = force_custom_plan;

EXPLAIN (ANALYZE, BUFFERS)
EXECUTE next_jobs('READY');
```

Inspect `EXPLAIN (ANALYZE, BUFFERS)` for the chosen scan, row estimates, actual rows, buffer reads, and planning versus execution time. Also verify that table statistics are current before attributing every plan change to prepared-plan selection.

## Why the other options are incorrect

- b. A partial-index predicate column does not have to be the first indexed key or even an indexed key. This index stores `created_at` entries for rows whose status is READY.
- c. PostgreSQL does not categorically disable indexes after a fixed execution count. It may choose between custom and generic plans based on estimated cost, and either kind of plan can use indexes when valid.
- d. Because the partial-index predicate already restricts entries to READY rows, `created_at` can support the ordering without adding `status` as a leading index key.
