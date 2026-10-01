---
id: concurrency-invoice-batch-atomic-claim
status: draft
---

## Question

An invoice service groups pending invoices into settlement batches. Which smallest change preserves the batching contract when workers call this service concurrently?

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class InvoiceQueue {
    private final List<Invoice> pending =
        Collections.synchronizedList(new ArrayList<>());

    public void submit(Invoice invoice) {
        pending.add(invoice);
    }

    public List<Invoice> takeBatch(int maxSize) {
        if (maxSize <= 0) {
            throw new IllegalArgumentException("invalid batch size");
        }

        int end = Math.min(maxSize, pending.size());
        List<Invoice> batch =
            new ArrayList<>(pending.subList(0, end));
        batch.forEach(pending::remove);
        return batch;
    }

    public record Invoice(String id, long cents) {}
}
```

## Answers

a. Synchronize on `pending` around the size, copy, and removal steps.
b. Replace `ArrayList` with `Vector` and keep the method unchanged.
c. Copy the list first, then remove each selected invoice after settlement.
d. Synchronize only the removal loop; leave the batch selection outside the lock.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

The list methods are safe individually, but copy and removal are not one atomic claim. Holding the list monitor across the sequence prevents two workers from returning the same invoice.

</details>
