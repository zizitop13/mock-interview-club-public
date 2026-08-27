---
id: java-constructor-listener-escape
status: published
---

## Question

This class works in single-threaded tests. What can happen if the event bus dispatches on another thread during construction?

```java
final class PriceCache {
    private final ConcurrentMap<String, BigDecimal> prices =
        new ConcurrentHashMap<>();
    private final Executor executor;

    PriceCache(EventBus events, Executor executor) {
        events.register(this::onPrice);
        this.executor = executor;
    }

    private void onPrice(PriceChanged event) {
        executor.execute(() ->
            prices.put(event.symbol(), event.price()));
    }
}
```

## Answers

a. ConcurrentHashMap can corrupt because registration makes its writes unsynchronized.
b. The method reference retains only onPrice, so the PriceCache instance may be collected.
c. Final-field semantics postpone callbacks until every constructor assignment is visible.
d. A callback may see executor as null because this escapes before assignment completes.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

Registering the bound method reference publishes `this` before construction finishes. A concurrent callback can run before `executor` is assigned and throw `NullPointerException`.

</details>
