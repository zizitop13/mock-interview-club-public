package club.mockinterview.concurrency;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Semaphore;

public final class ExchangeRateService {
    private final Semaphore providerSlots;
    private final HttpRateGateway gateway;
    private final boolean completionScopedPermits;

    public ExchangeRateService(HttpRateGateway gateway, int maximumInFlight) {
        this(gateway, maximumInFlight, false);
    }

    private ExchangeRateService(
            HttpRateGateway gateway,
            int maximumInFlight,
            boolean completionScopedPermits) {
        this.gateway = Objects.requireNonNull(gateway);
        this.providerSlots = new Semaphore(maximumInFlight);
        this.completionScopedPermits = completionScopedPermits;
    }

    public static ExchangeRateService withCompletionScopedPermits(
            HttpRateGateway gateway, int maximumInFlight) {
        return new ExchangeRateService(gateway, maximumInFlight, true);
    }

    public CompletableFuture<BigDecimal> quote(String pair)
            throws InterruptedException {
        providerSlots.acquire();
        if (!completionScopedPermits) {
            try {
                return gateway.fetch(pair);
            } finally {
                providerSlots.release();
            }
        }

        try {
            CompletableFuture<BigDecimal> request = gateway.fetch(pair);
            return request.whenComplete(
                    (rate, failure) -> providerSlots.release());
        } catch (RuntimeException | Error submissionFailure) {
            providerSlots.release();
            throw submissionFailure;
        }
    }

    int availableSlots() {
        return providerSlots.availablePermits();
    }

    @FunctionalInterface
    public interface HttpRateGateway {
        CompletableFuture<BigDecimal> fetch(String pair);
    }
}
