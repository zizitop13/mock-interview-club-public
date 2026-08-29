---
id: java-completable-future-timeout-pool-saturation
status: draft
---

## Question

The API initially returns fallbacks within 200 ms, but stops recovering after the pricing service slows down. Why can all 20 pool threads remain occupied?

```java
private final ExecutorService ioPool =
    Executors.newFixedThreadPool(20);

CompletionStage<Quote> quote(QuoteRequest request) {
    return CompletableFuture
        .supplyAsync(() -> pricingClient.fetch(request), ioPool)
        .orTimeout(200, TimeUnit.MILLISECONDS)
        .exceptionally(error -> Quote.unavailable());
}
```

## Answers

a. orTimeout completes the future, but the blocking supplier can keep its pool worker occupied.
b. orTimeout interrupts the supplier, but its completion handler blocks the common pool.
c. Each timeout creates a replacement worker, so the pool grows beyond its configured maximum.
d. A timed-out future stays incomplete, preventing subsequent stages from returning the fallback.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

orTimeout completes the future exceptionally; it does not stop a supplier already blocked in I/O. Repeated slow calls can pin every worker even while callers receive fallbacks.

</details>
