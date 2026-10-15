package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class HedgedCaptureServiceTest {
    private static final HedgedCaptureService.Payment PAYMENT =
            new HedgedCaptureService.Payment("pay-42", 12_500);

    @Test
    void differentAttemptKeysAllowTwoProcessorCaptures() {
        ManualExecutor delay = new ManualExecutor();
        IdempotentProcessor processor = new IdempotentProcessor();
        HedgedCaptureService service =
                new HedgedCaptureService(processor, delay,
                        new Sequence("primary-key", "hedge-key"));

        CompletableFuture<HedgedCaptureService.Receipt> result =
                service.capture(PAYMENT);
        delay.runAll();

        assertEquals(2, processor.captureCount());
        processor.completeAll();
        result.join();
    }

    @Test
    void oneRequestKeyCollapsesPrimaryAndHedge() {
        ManualExecutor delay = new ManualExecutor();
        IdempotentProcessor processor = new IdempotentProcessor();
        HedgedCaptureService service =
                new HedgedCaptureService(processor, delay);

        CompletableFuture<HedgedCaptureService.Receipt> result =
                service.capture(PAYMENT, "merchant-request-42");
        delay.runAll();

        assertEquals(1, processor.captureCount());
        processor.completeAll();
        assertEquals("capture-1", result.join().captureId());
    }

    private static final class Sequence implements Supplier<String> {
        private final Queue<String> values = new ArrayDeque<>();

        Sequence(String... values) {
            this.values.addAll(java.util.List.of(values));
        }

        @Override
        public String get() {
            return values.remove();
        }
    }

    private static final class ManualExecutor implements Executor {
        private final Queue<Runnable> tasks = new ArrayDeque<>();

        @Override
        public void execute(Runnable command) {
            tasks.add(command);
        }

        void runAll() {
            Runnable task;
            while ((task = tasks.poll()) != null) {
                task.run();
            }
        }
    }

    private static final class IdempotentProcessor
            implements HedgedCaptureService.Processor {
        private final Map<String, CompletableFuture<HedgedCaptureService.Receipt>>
                captures = new LinkedHashMap<>();

        @Override
        public CompletableFuture<HedgedCaptureService.Receipt> capture(
                HedgedCaptureService.Payment payment, String idempotencyKey) {
            return captures.computeIfAbsent(idempotencyKey, ignored ->
                    new CompletableFuture<>());
        }

        int captureCount() {
            return captures.size();
        }

        void completeAll() {
            int number = 1;
            for (CompletableFuture<HedgedCaptureService.Receipt> capture
                    : captures.values()) {
                capture.complete(new HedgedCaptureService.Receipt(
                        "capture-" + number++));
            }
        }
    }
}
