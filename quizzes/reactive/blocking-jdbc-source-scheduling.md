---
id: reactive-blocking-jdbc-source-scheduling
status: draft
---

## Question

A WebFlux handler receives exactly 200 IDs. The JDBC pool has 20 connections, `findBlocking` holds one until it returns, and `boundedElastic` can run all 200 tasks. The goal is up to 20 concurrent calls without blocking the event loop. Which implementation meets every condition?

```java
Flux<Order> findAll(List<Long> ids) {
    return Flux.fromIterable(ids)
        .flatMap(id -> Mono.fromCallable(() -> repo.findBlocking(id)));
}
```

## Answers

a. Add one outer `subscribeOn(boundedElastic())`; leave `flatMap` concurrency unchanged.
b. Use inner `subscribeOn(boundedElastic())`; call `flatMap(mapper, 200, 20)`.
c. Use inner `publishOn(boundedElastic())`; set `flatMap` concurrency to 20.
d. Use inner `subscribeOn(boundedElastic())`; set `flatMap` concurrency to 20.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

Inner `subscribeOn` moves each blocking source off the event loop. The `flatMap` concurrency argument limits active inner subscriptions to 20, matching the JDBC pool.

</details>
