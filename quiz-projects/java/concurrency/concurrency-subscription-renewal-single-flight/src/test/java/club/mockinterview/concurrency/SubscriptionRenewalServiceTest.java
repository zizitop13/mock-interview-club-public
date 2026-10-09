package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class SubscriptionRenewalServiceTest {
    @Test
    void checkThenActCanChargeOneRenewalTwice() throws Exception {
        AtomicInteger gatewayCalls = new AtomicInteger();
        CyclicBarrier bothChargesStarted = new CyclicBarrier(2);
        SubscriptionRenewalService service = new SubscriptionRenewalService(
                (renewalId, cents) -> {
                    int call = gatewayCalls.incrementAndGet();
                    await(bothChargesStarted);
                    return new SubscriptionRenewalService.Receipt(
                            "receipt-" + call,
                            cents);
                });
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<SubscriptionRenewalService.Receipt> first = executor.submit(
                    () -> service.renew("renewal-42", 2_500));
            Future<SubscriptionRenewalService.Receipt> second = executor.submit(
                    () -> service.renew("renewal-42", 2_500));

            SubscriptionRenewalService.Receipt firstReceipt = first.get(1, SECONDS);
            SubscriptionRenewalService.Receipt secondReceipt = second.get(1, SECONDS);

            assertEquals(2, gatewayCalls.get());
            assertNotEquals(firstReceipt, secondReceipt);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void singleFlightSharesOneChargeAndOneReceipt() throws Exception {
        AtomicInteger gatewayCalls = new AtomicInteger();
        CountDownLatch gatewayEntered = new CountDownLatch(1);
        CountDownLatch finishCharge = new CountDownLatch(1);
        SubscriptionRenewalService service =
                SubscriptionRenewalService.withSingleFlight((renewalId, cents) -> {
                    gatewayCalls.incrementAndGet();
                    gatewayEntered.countDown();
                    await(finishCharge);
                    return new SubscriptionRenewalService.Receipt("receipt-1", cents);
                });
        CyclicBarrier callersReady = new CyclicBarrier(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<SubscriptionRenewalService.Receipt> first = executor.submit(() -> {
                await(callersReady);
                return service.renew("renewal-42", 2_500);
            });
            Future<SubscriptionRenewalService.Receipt> second = executor.submit(() -> {
                await(callersReady);
                return service.renew("renewal-42", 2_500);
            });

            assertTrue(gatewayEntered.await(1, SECONDS));
            finishCharge.countDown();

            assertEquals(first.get(1, SECONDS), second.get(1, SECONDS));
            assertEquals(1, gatewayCalls.get());
        } finally {
            finishCharge.countDown();
            executor.shutdownNow();
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(1, SECONDS);
        } catch (Exception failure) {
            throw new AssertionError(failure);
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(1, SECONDS)) {
                throw new AssertionError("timed out waiting for test boundary");
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new AssertionError(interrupted);
        }
    }
}
