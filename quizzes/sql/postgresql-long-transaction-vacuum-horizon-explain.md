# Long-lived PostgreSQL transactions and the VACUUM horizon

## Correct answer

b. Its old backend_xmin pins the cleanup horizon, so VACUUM must retain visible row versions.

## Detailed explanation

PostgreSQL MVCC keeps old row versions so transactions can read the database as it appeared to their snapshots. An `UPDATE` normally creates a new tuple version and leaves the old one dead for newer transactions. `VACUUM` can reclaim an old version only when no relevant snapshot may still need to see it.

A transaction left open for a long time can advertise an old `backend_xmin`. That contributes to the cleanup horizon: tuple versions new transactions consider dead may still be visible according to the old transaction's snapshot. Autovacuum can run and finish without reclaiming those versions. Continued updates then create more dead tuples, indexes retain references to them, table size grows, and queries perform more I/O.

The session being `idle in transaction` does not mean it is harmless. It means the backend is currently waiting for the client while its transaction remains open. The underlying causes often include leaked transactions, disabled auto-commit, a request waiting on remote I/O before commit, or an interactive SQL session forgotten after `BEGIN`.

Investigate both the oldest transactions and the tables accumulating dead tuples. Confirm the application owner and impact before terminating anything. After the blocker ends, ordinary vacuum may reclaim reusable space inside the relation, but it usually does not return that space to the operating system. `VACUUM FULL` rewrites and locks the table, so it requires deliberate planning rather than being an automatic first response.

## Code example

```sql
-- Find long-running transactions and their cleanup horizons.
SELECT pid,
       usename,
       application_name,
       state,
       now() - xact_start AS transaction_age,
       backend_xmin,
       wait_event_type,
       wait_event,
       query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start;

-- Find user tables accumulating dead tuples.
SELECT schemaname,
       relname,
       n_live_tup,
       n_dead_tup,
       last_autovacuum,
       autovacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;

-- End the transaction at its source when possible.
-- If operationally approved, terminate the confirmed blocker:
SELECT pg_terminate_backend(8142);

-- Prevent forgotten idle transactions from persisting indefinitely.
ALTER ROLE app_user
SET idle_in_transaction_session_timeout = '60s';
```

Also inspect replication slots and prepared transactions: they can independently hold back cleanup even when `pg_stat_activity` shows no old client transaction. Monitor transaction age, dead-tuple growth, autovacuum duration, and storage rather than relying on a single counter.

## Why the other options are incorrect

- a. Autovacuum does not stop globally merely because a session is idle in a transaction. It can still process tables, but it cannot remove versions that an old snapshot may require.
- c. `ANALYZE` samples live table data to update planner statistics; it does not intentionally preserve dead tuples to measure update frequency.
- d. An idle transaction may hold locks acquired earlier, but ordinary `VACUUM` is designed to run alongside normal reads and writes. The shown `backend_xmin`, not an `n_dead_tup` lock threshold, explains the cleanup restriction.
