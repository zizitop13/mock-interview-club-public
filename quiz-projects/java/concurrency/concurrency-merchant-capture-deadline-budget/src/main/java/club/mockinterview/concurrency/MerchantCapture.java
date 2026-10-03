package club.mockinterview.concurrency;

import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.TimeoutException;
import java.util.function.LongSupplier;

public final class MerchantCapture {
    private static final int MAX_ATTEMPTS = 3;
    private static final Duration REQUEST_TIMEOUT = Duration.ofMillis(300);

    private final Processor processor;
    private final LongSupplier nanoTime;

    public MerchantCapture(Processor processor) {
        this(processor, System::nanoTime);
    }

    MerchantCapture(Processor processor, LongSupplier nanoTime) {
        this.processor = Objects.requireNonNull(processor);
        this.nanoTime = Objects.requireNonNull(nanoTime);
    }

    public String captureWithRestartedTimeout(String paymentId)
            throws TimeoutException {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                return processor.capture(paymentId, REQUEST_TIMEOUT);
            } catch (TimeoutException ignored) {
                // Retry the same idempotency key.
            }
        }
        throw deadlineExceeded();
    }

    public String captureWithinDeadline(String paymentId)
            throws TimeoutException {
        long deadline = nanoTime.getAsLong() + REQUEST_TIMEOUT.toNanos();

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            long remaining = deadline - nanoTime.getAsLong();
            if (remaining <= 0) {
                break;
            }

            try {
                return processor.capture(
                        paymentId,
                        Duration.ofNanos(remaining));
            } catch (TimeoutException ignored) {
                // Recompute the shared remaining budget before retrying.
            }
        }
        throw deadlineExceeded();
    }

    private static TimeoutException deadlineExceeded() {
        return new TimeoutException("capture deadline exceeded");
    }

    @FunctionalInterface
    public interface Processor {
        String capture(String paymentId, Duration timeout)
                throws TimeoutException;
    }
}
