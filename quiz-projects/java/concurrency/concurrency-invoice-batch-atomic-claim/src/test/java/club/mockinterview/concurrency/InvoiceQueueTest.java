package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;

class InvoiceQueueTest {
    @Test
    void individuallySynchronizedOperationsCanReturnOneInvoiceTwice() throws Exception {
        CyclicBarrier bothBatchesCopied = new CyclicBarrier(2);
        InvoiceQueue queue = new InvoiceQueue(() -> await(bothBatchesCopied));
        InvoiceQueue.Invoice invoice = new InvoiceQueue.Invoice("invoice-7", 10_00);
        queue.submit(invoice);

        List<List<InvoiceQueue.Invoice>> batches = callTogether(
                () -> queue.takeBatchUnsafe(1),
                () -> queue.takeBatchUnsafe(1));

        assertEquals(List.of(invoice), batches.get(0));
        assertEquals(List.of(invoice), batches.get(1));
        assertEquals(0, queue.pendingCount());
    }

    @Test
    void compoundLockLetsExactlyOneWorkerClaimTheInvoice() throws Exception {
        CyclicBarrier startTogether = new CyclicBarrier(2);
        InvoiceQueue queue = new InvoiceQueue();
        InvoiceQueue.Invoice invoice = new InvoiceQueue.Invoice("invoice-7", 10_00);
        queue.submit(invoice);

        List<List<InvoiceQueue.Invoice>> batches = callTogether(
                () -> takeTogether(queue, startTogether),
                () -> takeTogether(queue, startTogether));

        List<InvoiceQueue.Invoice> claimed = batches.stream()
                .flatMap(List::stream)
                .toList();
        assertEquals(List.of(invoice), claimed);
        assertEquals(1L, batches.stream().filter(List::isEmpty).count());
        assertEquals(0, queue.pendingCount());
    }

    private static List<InvoiceQueue.Invoice> takeTogether(
            InvoiceQueue queue,
            CyclicBarrier startTogether) {
        await(startTogether);
        return queue.takeBatchAtomically(1);
    }

    private static <T> List<T> callTogether(
            Callable<T> first,
            Callable<T> second) throws Exception {
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<T> firstResult = workers.submit(first);
            Future<T> secondResult = workers.submit(second);
            return List.of(
                    firstResult.get(2, SECONDS),
                    secondResult.get(2, SECONDS));
        } finally {
            workers.shutdownNow();
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(2, SECONDS);
        } catch (Exception failure) {
            throw new IllegalStateException("concurrent test did not reach its barrier", failure);
        }
    }
}
