---
id: caching-fleet-single-flight
status: draft
---

## Question

Two Spring service instances share Redis but use separate process-local per-key locks. Each request checks Redis, takes its local lock, rechecks Redis, then loads the database. A hot key is absent and one request reaches each instance concurrently. Which result and fix are correct?

```text
Current design: both initial GETs miss; a DB load cannot finish before both instances recheck.
No component fails.
Shared-lease candidate: holder finishes before expiry; waiter rechecks Redis after release.
```

## Answers

a. One read occurs because the second Redis GET observes the first instance's local lock.
b. Two reads occur; adding TTL jitter guarantees one loader for this already-missing key.
c. One read occurs because Redis serializes all GET operations for the same cache key.
d. Two reads occur; use a fleet-wide per-key lease, then recheck Redis inside the lease.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

Each JVM owns a different lock, so both loaders recheck the same miss and hit the database. A shared per-key lease plus a cache recheck inside it collapses the fleet load.

</details>
