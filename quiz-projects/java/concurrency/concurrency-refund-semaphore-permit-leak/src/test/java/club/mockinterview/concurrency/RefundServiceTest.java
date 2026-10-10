package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class RefundServiceTest {
    @Test
    void gatewayFailuresLeakEveryPermitInTheOriginalService() {
        AtomicInteger gatewayCalls = new AtomicInteger();
        RefundService service = new RefundService((paymentId, cents) -> {
            gatewayCalls.incrementAndGet();
            throw new GatewayFailure();
        }, 2);

        assertThrows(GatewayFailure.class,
                () -> service.refund("payment-1", 1_500));
        assertThrows(GatewayFailure.class,
                () -> service.refund("payment-2", 2_500));

        assertEquals(2, gatewayCalls.get());
        assertEquals(0, service.availableSlots());
    }

    @Test
    void finallyRestoresCapacityAfterFailures() throws Exception {
        AtomicInteger gatewayCalls = new AtomicInteger();
        RefundService service = RefundService.withSafeRelease((paymentId, cents) -> {
            int call = gatewayCalls.incrementAndGet();
            if (call <= 2) {
                throw new GatewayFailure();
            }
            return new RefundService.Receipt("refund-3");
        }, 2);

        assertThrows(GatewayFailure.class,
                () -> service.refund("payment-1", 1_500));
        assertThrows(GatewayFailure.class,
                () -> service.refund("payment-2", 2_500));

        assertEquals(2, service.availableSlots());
        assertEquals("refund-3",
                service.refund("payment-3", 3_500).refundId());
        assertEquals(2, service.availableSlots());
        assertEquals(3, gatewayCalls.get());
    }

    private static final class GatewayFailure extends RuntimeException {
    }
}
