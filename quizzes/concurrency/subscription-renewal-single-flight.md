---
id: concurrency-subscription-renewal-single-flight
status: published
---

## Question

Within one running JVM, each renewal ID fixes one amount, and the gateway either succeeds or fails before charging. Which smallest change gives concurrent calls for one renewal ID one stable result without serializing other IDs?

```java
import java.util.concurrent.ConcurrentHashMap;

public final class SubscriptionRenewalService {
    private final Gateway gateway;
    private final ConcurrentHashMap<String, Receipt> completed =
        new ConcurrentHashMap<>();

    public SubscriptionRenewalService(Gateway gateway) {
        this.gateway = gateway;
    }

    public Receipt renew(String renewalId, long cents) {
        Receipt previous = completed.get(renewalId);
        if (previous != null) return previous;

        Receipt charged = gateway.charge(renewalId, cents);
        completed.put(renewalId, charged);
        return charged;
    }

    public interface Gateway {
        Receipt charge(String renewalId, long cents);
    }

    public record Receipt(String receiptId, long cents) {}
}
```

## Answers

a. Call `putIfAbsent` after charging and return whichever receipt is stored.
b. Synchronize `renew`, serializing calls for every unrelated renewal ID.
c. Install a per-ID `CompletableFuture` with `putIfAbsent`; only its winner charges.
d. Synchronize only the map lookup and call the gateway outside that lock.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

`get`, charge, then `put` is not atomic, so two callers can charge. A per-ID future elects one caller before the side effect and replays its receipt.

</details>
