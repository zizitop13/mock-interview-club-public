package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ExchangeRateServiceTest {
    @Test
    void submissionScopedPermitsAllowMoreRequestsThanTheLimit() throws Exception {
        ManualHttpRateGateway gateway = new ManualHttpRateGateway();
        ExchangeRateService service = new ExchangeRateService(gateway, 2);

        CompletableFuture<BigDecimal> first = service.quote("EUR-USD");
        CompletableFuture<BigDecimal> second = service.quote("GBP-USD");
        CompletableFuture<BigDecimal> third = service.quote("CHF-USD");

        assertEquals(3, gateway.maximumInFlight());
        assertEquals(2, service.availableSlots());

        gateway.complete(0, "1.10");
        gateway.complete(1, "1.30");
        gateway.complete(2, "1.12");
        assertEquals(new BigDecimal("1.10"), first.join());
        assertEquals(new BigDecimal("1.30"), second.join());
        assertEquals(new BigDecimal("1.12"), third.join());
    }

    @Test
    void completionScopedPermitsTrackActualInFlightRequests() throws Exception {
        ManualHttpRateGateway gateway = new ManualHttpRateGateway();
        ExchangeRateService service =
                ExchangeRateService.withCompletionScopedPermits(gateway, 2);

        CompletableFuture<BigDecimal> first = service.quote("EUR-USD");
        CompletableFuture<BigDecimal> second = service.quote("GBP-USD");

        assertEquals(0, service.availableSlots());
        assertEquals(2, gateway.maximumInFlight());

        gateway.complete(0, "1.10");
        assertEquals(1, service.availableSlots());
        CompletableFuture<BigDecimal> third = service.quote("CHF-USD");

        assertEquals(0, service.availableSlots());
        assertEquals(2, gateway.maximumInFlight());

        gateway.complete(1, "1.30");
        gateway.complete(2, "1.12");
        assertEquals(new BigDecimal("1.10"), first.join());
        assertEquals(new BigDecimal("1.30"), second.join());
        assertEquals(new BigDecimal("1.12"), third.join());
        assertEquals(2, service.availableSlots());
    }

    private static final class ManualHttpRateGateway
            implements ExchangeRateService.HttpRateGateway {
        private final List<CompletableFuture<BigDecimal>> requests =
                new ArrayList<>();
        private final AtomicInteger inFlight = new AtomicInteger();
        private final AtomicInteger maximumInFlight = new AtomicInteger();

        @Override
        public synchronized CompletableFuture<BigDecimal> fetch(String pair) {
            int active = inFlight.incrementAndGet();
            maximumInFlight.accumulateAndGet(active, Math::max);
            CompletableFuture<BigDecimal> request = new CompletableFuture<>();
            request.whenComplete((rate, failure) -> inFlight.decrementAndGet());
            requests.add(request);
            return request;
        }

        synchronized void complete(int index, String rate) {
            requests.get(index).complete(new BigDecimal(rate));
        }

        int maximumInFlight() {
            return maximumInFlight.get();
        }
    }
}
