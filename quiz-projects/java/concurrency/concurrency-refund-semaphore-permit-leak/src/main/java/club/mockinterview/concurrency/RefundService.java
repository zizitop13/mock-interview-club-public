package club.mockinterview.concurrency;

import java.util.Objects;
import java.util.concurrent.Semaphore;

public final class RefundService {
    private final Gateway gateway;
    private final Semaphore gatewaySlots;
    private final boolean releaseOnFailure;

    public RefundService(Gateway gateway, int maxConcurrent) {
        this(gateway, maxConcurrent, false);
    }

    private RefundService(
            Gateway gateway,
            int maxConcurrent,
            boolean releaseOnFailure) {
        if (maxConcurrent < 1) {
            throw new IllegalArgumentException("maxConcurrent must be positive");
        }
        this.gateway = Objects.requireNonNull(gateway);
        this.gatewaySlots = new Semaphore(maxConcurrent);
        this.releaseOnFailure = releaseOnFailure;
    }

    public static RefundService withSafeRelease(
            Gateway gateway,
            int maxConcurrent) {
        return new RefundService(gateway, maxConcurrent, true);
    }

    public Receipt refund(String paymentId, long cents)
            throws InterruptedException {
        Objects.requireNonNull(paymentId);
        return releaseOnFailure
                ? refundWithFinally(paymentId, cents)
                : refundWithPermitLeak(paymentId, cents);
    }

    private Receipt refundWithPermitLeak(String paymentId, long cents)
            throws InterruptedException {
        gatewaySlots.acquire();
        Receipt receipt = gateway.refund(paymentId, cents);
        gatewaySlots.release();
        return receipt;
    }

    private Receipt refundWithFinally(String paymentId, long cents)
            throws InterruptedException {
        gatewaySlots.acquire();
        try {
            return gateway.refund(paymentId, cents);
        } finally {
            gatewaySlots.release();
        }
    }

    int availableSlots() {
        return gatewaySlots.availablePermits();
    }

    public interface Gateway {
        Receipt refund(String paymentId, long cents);
    }

    public record Receipt(String refundId) {
        public Receipt {
            Objects.requireNonNull(refundId);
        }
    }
}
