# Claiming an invoice batch atomically

## Correct answer

a. Synchronize on `pending` around the size, copy, and removal steps.

## Detailed explanation

The business invariant is that each queued invoice may be claimed by at most one settlement batch.

`Collections.synchronizedList` protects each list method independently. It does not combine `size`, `subList` copying, and removal into one transaction. Two workers can both copy the same leading invoice before either worker removes it. The first removal succeeds, the second becomes a no-op, but both workers still return and may settle their identical copies.

The smallest fix is to synchronize on the list returned by `synchronizedList` for the complete selection-and-removal sequence. That is the same monitor used by the wrapper's individual methods, so submissions cannot interleave with a batch claim and another worker cannot select the same entries. The critical section performs only in-memory list operations; settlement I/O must happen after the lock is released.

For a higher-throughput design, a queue with atomic polling could also model claiming, but that is a larger data-structure change. Under the question's smallest-change criterion, one compound synchronized block is the direct fix.

## Code example

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
        synchronized (pending) {
            int end = Math.min(maxSize, pending.size());
            List<Invoice> batch =
                new ArrayList<>(pending.subList(0, end));
            batch.forEach(pending::remove);
            return batch;
        }
    }

    public record Invoice(String id, long cents) {}
}
```

The runnable reproduction pauses two workers after each has copied the same invoice, then proves that both unsafe calls return it. The fix test starts two workers together and proves that their atomic batches contain the invoice exactly once in total.

## Why the other options are incorrect

- b. `Vector` also synchronizes individual methods; it does not make this multi-step claim atomic.
- c. A detached copy does not claim anything, and delaying removal allows concurrent workers to settle the same invoice before either removes it.
- d. Serializing only the removal loop is too late because both workers may already hold copies that they will return for settlement.
