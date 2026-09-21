package club.mockinterview.observability;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

class MdcExecutorContextTest {
    private static final String TRACE_ID = "traceId";

    private ExecutorService worker;

    @AfterEach
    void cleanUp() throws Exception {
        MDC.clear();
        if (worker != null) {
            worker.submit(MDC::clear).get(2, TimeUnit.SECONDS);
            worker.shutdownNow();
            worker.awaitTermination(2, TimeUnit.SECONDS);
        }
    }

    @Test
    void reproducesMissingAndStaleContextOnAReusedWorker() throws Exception {
        worker = Executors.newSingleThreadExecutor();
        worker.submit(MDC::clear).get(2, TimeUnit.SECONDS);

        MDC.put(TRACE_ID, "request-1");
        assertNull(worker.submit(() -> MDC.get(TRACE_ID)).get(2, TimeUnit.SECONDS));

        worker.submit(() -> MDC.put(TRACE_ID, "leaked-request")).get(2, TimeUnit.SECONDS);
        MDC.put(TRACE_ID, "request-2");

        assertEquals("leaked-request",
                worker.submit(() -> MDC.get(TRACE_ID)).get(2, TimeUnit.SECONDS));
    }

    @Test
    void propagatesSubmissionContextAndRestoresWorkerContextAfterFailure() throws Exception {
        worker = Executors.newSingleThreadExecutor();
        worker.submit(() -> MDC.put(TRACE_ID, "worker-baseline")).get(2, TimeUnit.SECONDS);
        MdcPropagatingExecutor contextual = new MdcPropagatingExecutor(worker);

        MDC.put(TRACE_ID, "request-42");
        assertEquals("request-42",
                CompletableFuture.supplyAsync(() -> MDC.get(TRACE_ID), contextual)
                        .get(2, TimeUnit.SECONDS));

        MDC.put(TRACE_ID, "request-failure");
        CompletableFuture<Void> failed = CompletableFuture.runAsync(() -> {
            assertEquals("request-failure", MDC.get(TRACE_ID));
            throw new IllegalStateException("simulated task failure");
        }, contextual);
        assertThrows(CompletionException.class, failed::join);

        assertEquals("worker-baseline",
                worker.submit(() -> MDC.get(TRACE_ID)).get(2, TimeUnit.SECONDS));
    }
}
