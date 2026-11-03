---
id: java-completable-future-exceptionally-recovery
status: draft
---

## Question

A risk outage should fail checkout, yet some orders are still approved and published. What is wrong with this asynchronous pipeline?

```java
CompletionStage<Void> review(Order order) {
    return riskScore(order)
        .thenApply(this::decide)
        .exceptionally(error -> Decision.approved("fallback"))
        .thenApply(decision -> reserveInventory(order, decision))
        .thenAccept(this::publishApproved);
}
```

## Answers

a. exceptionally retries the risk call, so the same order may be approved twice.
b. exceptionally turns failure into approval, so later success stages still execute.
c. exceptionally handles only cancellation, so risk failures bypass the fallback.
d. exceptionally keeps the failed state while exposing a value only to its callback.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

exceptionally replaces a failure with a normal value. Returning an approved decision makes reservation and publication run as if risk scoring succeeded.

</details>
