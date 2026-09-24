---
id: resilience-layered-retry-amplification
status: published
---

## Question

Gateway makes at most 3 total attempts to Order Service. For every gateway attempt, Order Service independently makes at most 3 total attempts to Inventory. Inventory always returns 503 immediately; no deadline, circuit breaker, or shared retry budget exists. Calls are sequential. What follows?

```text
gateway.maxAttempts = 3
order.inventory.maxAttempts = 3
```

## Answers

a. Inventory receives 3 calls because both layers share the same implicit attempt budget.
b. Inventory receives 6 calls because only retries, not initial attempts, multiply.
c. Inventory receives 9 calls; one retry owner or a shared budget must cap amplification.
d. Inventory receives 27 calls because every initial call creates another retry layer.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

Independent retry loops multiply: three gateway attempts each trigger three Inventory attempts, producing nine calls. One retry owner or a shared end-to-end budget caps amplification.

</details>
