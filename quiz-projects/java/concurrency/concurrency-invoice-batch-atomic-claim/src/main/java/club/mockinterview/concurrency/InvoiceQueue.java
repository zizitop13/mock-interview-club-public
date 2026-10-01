package club.mockinterview.concurrency;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class InvoiceQueue {
    private final List<Invoice> pending =
            Collections.synchronizedList(new ArrayList<>());
    private final Runnable afterUnsafeCopy;

    public InvoiceQueue() {
        this(() -> { });
    }

    InvoiceQueue(Runnable afterUnsafeCopy) {
        this.afterUnsafeCopy = Objects.requireNonNull(afterUnsafeCopy);
    }

    public void submit(Invoice invoice) {
        pending.add(Objects.requireNonNull(invoice));
    }

    public List<Invoice> takeBatchUnsafe(int maxSize) {
        requirePositive(maxSize);
        int end = Math.min(maxSize, pending.size());
        List<Invoice> batch = new ArrayList<>(pending.subList(0, end));
        afterUnsafeCopy.run();
        batch.forEach(pending::remove);
        return batch;
    }

    public List<Invoice> takeBatchAtomically(int maxSize) {
        requirePositive(maxSize);
        synchronized (pending) {
            int end = Math.min(maxSize, pending.size());
            List<Invoice> batch = new ArrayList<>(pending.subList(0, end));
            batch.forEach(pending::remove);
            return batch;
        }
    }

    public int pendingCount() {
        return pending.size();
    }

    private static void requirePositive(int maxSize) {
        if (maxSize <= 0) {
            throw new IllegalArgumentException("invalid batch size");
        }
    }

    public record Invoice(String id, long cents) {
        public Invoice {
            Objects.requireNonNull(id);
            if (cents <= 0) {
                throw new IllegalArgumentException("invalid amount");
            }
        }
    }
}
