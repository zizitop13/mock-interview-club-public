package club.mockinterview.resilience;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

class RetryTopologyTest {
    @Test
    void reproducesMultiplicationFromIndependentRetryLoops() {
        AtomicInteger inventoryCalls = new AtomicInteger();
        RetryTopology flow = failingFlow(inventoryCalls);

        assertThrows(
                RetryTopology.ServiceUnavailableException.class,
                flow::callWithIndependentRetries);
        assertEquals(9, inventoryCalls.get());
    }

    @Test
    void oneRetryOwnerCapsTheDownstreamAttemptCount() {
        AtomicInteger inventoryCalls = new AtomicInteger();
        RetryTopology flow = failingFlow(inventoryCalls);

        assertThrows(
                RetryTopology.ServiceUnavailableException.class,
                flow::callWithGatewayOwnedRetry);
        assertEquals(3, inventoryCalls.get());
    }

    private static RetryTopology failingFlow(AtomicInteger calls) {
        return new RetryTopology(() -> {
            calls.incrementAndGet();
            throw new RetryTopology.ServiceUnavailableException();
        });
    }
}
