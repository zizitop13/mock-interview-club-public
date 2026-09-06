---
id: sql-postgresql-long-transaction-vacuum-horizon
status: published
---

## Question

Updates continue and autovacuum runs, yet dead tuples and table size keep growing. What does this long-lived idle transaction explain?

```sql
SELECT pid, state, xact_start, backend_xmin, query
FROM pg_stat_activity
WHERE state = 'idle in transaction';

 pid  |        state        |      xact_start      | backend_xmin
------+---------------------+----------------------+--------------
 8142 | idle in transaction | 2026-09-05 08:10:00  |       912340
```

## Answers

a. Autovacuum skips every table whenever any database session is idle inside a transaction.
b. Its old backend_xmin pins the cleanup horizon, so VACUUM must retain visible row versions.
c. ANALYZE retains dead tuples from old transactions to estimate how frequently rows change.
d. The backend holds a table lock that disables VACUUM after n_dead_tup reaches its threshold.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

A long-lived snapshot can still need old row versions. Its backend_xmin holds back the global cleanup horizon, so VACUUM cannot remove those versions and bloat accumulates.

</details>
