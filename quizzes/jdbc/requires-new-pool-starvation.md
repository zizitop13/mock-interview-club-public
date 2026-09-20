---
id: jdbc-requires-new-pool-starvation
status: published
---

## Question

Twenty request threads each start an outer Spring JDBC transaction and invoke another bean's `REQUIRES_NEW` method. The 20-connection pool stops making progress. Under the assumptions below, what is the cause and the smallest pool size that guarantees progress?

```text
all 20 outer transactions execute SQL, retain one connection, then reach a barrier
each inner transaction performs one JDBC write and immediately commits
there are no other pool users or database locks
acquisition never times out; a released connection is eventually granted to a waiter
```

## Answers

a. Suspension returns outer connections to the pool, so 20 connections are sufficient.
b. Each inner transaction reuses its outer connection, so 20 connections are sufficient.
c. Each request needs two connections concurrently, so 40 connections are the minimum.
d. One extra connection lets inners complete sequentially, so 21 connections are the minimum.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

`REQUIRES_NEW` keeps each outer connection bound while acquiring another. One spare connection lets an inner commit, release it, and unblock the next waiter.

</details>
