---
id: java-nested-executor-starvation
status: draft
---

## Question

A two-thread enrichment pool works for one request but stalls when two requests arrive together. Why?

```java
CompletableFuture<Profile> enrich(String id) {
    return CompletableFuture.supplyAsync(() -> {
        return CompletableFuture
            .supplyAsync(() -> client.fetch(id), pool)
            .join();
    }, pool);
}
```

## Answers

a. Use a fair queue so inner tasks run before the outer tasks that are already executing.
b. Replace `join` with `get`; `get` returns the worker while waiting for the child future.
c. Increase queue capacity so inner fetch tasks can start while all workers are occupied.
d. Remove nesting and submit each blocking fetch as the only pool task for that request.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

Outer tasks occupy every worker and wait for inner tasks queued on the same pool. With no free worker, nothing can complete; submit only the actual fetch.

</details>
