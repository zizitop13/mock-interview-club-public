---
id: concurrency-exchange-rate-async-bulkhead-lifetime
status: published
---

## Question

An exchange-rate service limits concurrent HTTP calls to protect its provider. Which smallest change preserves that capacity boundary under load?

```java
import java.math.BigDecimal;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Semaphore;

public final class ExchangeRateService {
    private final Semaphore providerSlots = new Semaphore(20);
    private final HttpRateGateway gateway;

    public ExchangeRateService(HttpRateGateway gateway) {
        this.gateway = gateway;
    }

    public CompletableFuture<BigDecimal> quote(String pair)
            throws InterruptedException {
        providerSlots.acquire();
        try {
            return gateway.fetch(pair);
        } finally {
            providerSlots.release();
        }
    }

    public interface HttpRateGateway {
        CompletableFuture<BigDecimal> fetch(String pair);
    }
}
```

## Answers

a. Acquire the permit in `thenApply` and keep the current `finally` release.
b. Increase permits to the common-pool parallelism and keep the current lifetime.
c. Release on future completion, also releasing if `fetch` throws synchronously.
d. Synchronize `quote` so only one caller can submit an HTTP request at a time.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

The `finally` runs when `fetch` returns its future, not when HTTP I/O ends. Hold the permit until completion, with a separate release if submission itself throws.

</details>
