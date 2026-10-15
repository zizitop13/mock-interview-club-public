package club.mockinterview.concurrency;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.function.Function;
import java.util.function.Supplier;

public final class HedgedCaptureService {
    private final Processor processor;
    private final Executor hedgeDelay;
    private final Supplier<String> attemptKeys;

    public HedgedCaptureService(Processor processor, Executor hedgeDelay) {
        this(processor, hedgeDelay, () -> UUID.randomUUID().toString());
    }

    HedgedCaptureService(
            Processor processor,
            Executor hedgeDelay,
            Supplier<String> attemptKeys) {
        this.processor = processor;
        this.hedgeDelay = hedgeDelay;
        this.attemptKeys = attemptKeys;
    }

    public CompletableFuture<Receipt> capture(Payment payment) {
        return race(payment, attemptKeys.get(), attemptKeys.get());
    }

    public CompletableFuture<Receipt> capture(
            Payment payment, String idempotencyKey) {
        return race(payment, idempotencyKey, idempotencyKey);
    }

    private CompletableFuture<Receipt> race(
            Payment payment, String primaryKey, String hedgeKey) {
        CompletableFuture<Receipt> primary =
                processor.capture(payment, primaryKey);
        CompletableFuture<Receipt> hedge = CompletableFuture
                .runAsync(() -> {}, hedgeDelay)
                .thenCompose(ignored -> processor.capture(payment, hedgeKey));
        return primary.applyToEither(hedge, Function.identity());
    }

    public record Payment(String paymentId, long cents) {}
    public record Receipt(String captureId) {}

    public interface Processor {
        CompletableFuture<Receipt> capture(
                Payment payment, String idempotencyKey);
    }
}
