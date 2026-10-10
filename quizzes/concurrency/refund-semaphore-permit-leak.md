---
id: concurrency-refund-semaphore-permit-leak
status: draft
---

## Question

A refund API limits concurrent calls to its payment gateway. Which smallest change preserves bounded progress when this service is under load?

```java
import java.util.concurrent.Semaphore;

public final class RefundService {
    private final Semaphore gatewaySlots = new Semaphore(20);
    private final Gateway gateway;

    public RefundService(Gateway gateway) {
        this.gateway = gateway;
    }

    public Receipt refund(String paymentId, long cents)
            throws InterruptedException {
        gatewaySlots.acquire();
        Receipt receipt = gateway.refund(paymentId, cents);
        gatewaySlots.release();
        return receipt;
    }

    public interface Gateway {
        Receipt refund(String paymentId, long cents);
    }

    public record Receipt(String refundId) {}
}
```

## Answers

a. Put the gateway call in `try` and release the acquired permit from `finally`.
b. Enable semaphore fairness so waiting refund calls acquire permits in arrival order.
c. Increase the permit count so occasional gateway failures cannot exhaust capacity.
d. Synchronize `refund` and leave the permit release after the gateway call.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

If the gateway throws, `release` is skipped and one permit is lost. `finally` preserves the invariant that every successful acquire has exactly one release.

</details>
