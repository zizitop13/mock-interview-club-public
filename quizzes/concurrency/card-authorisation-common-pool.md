---
id: concurrency-card-authorisation-common-pool
status: draft
---

## Question

A card service calls a blocking issuer API for every authorisation. On a server where `supplyAsync` uses the common pool, which change adds bounded isolation for this work?

```java
import java.util.concurrent.CompletableFuture;

public final class CardAuthorizer {
    private final Issuer issuer;

    public CardAuthorizer(Issuer issuer) {
        this.issuer = issuer;
    }

    public CompletableFuture<Decision> authorize(Request request) {
        return CompletableFuture.supplyAsync(
            () -> issuer.authorize(request));
    }

    public record Request(String cardId, long cents) {}

    public enum Decision { APPROVED, DECLINED }

    public interface Issuer {
        Decision authorize(Request request);
    }
}
```

## Answers

a. Add `thenApplyAsync` so completion no longer runs on the common-pool worker.
b. Replace `supplyAsync` with `runAsync`; blocking calls then receive extra workers.
c. Increase common-pool parallelism so issuer calls cannot delay unrelated async work.
d. Pass a dedicated bounded executor to `supplyAsync` and handle rejected submissions.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

The blocking supplier occupies workers shared by unrelated tasks. A bounded issuer executor isolates concurrency and backlog, while rejection enables explicit load shedding.

</details>
