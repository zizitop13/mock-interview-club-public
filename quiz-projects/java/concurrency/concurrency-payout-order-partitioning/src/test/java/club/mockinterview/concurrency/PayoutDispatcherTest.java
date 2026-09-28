package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;

class PayoutDispatcherTest {
    @Test
    void sharedPoolAllowsALaterMerchantPayoutToFinishFirst() throws Exception {
        CountDownLatch firstStarted = new CountDownLatch(1);
        CountDownLatch secondFinished = new CountDownLatch(1);
        List<Long> completionOrder = Collections.synchronizedList(new ArrayList<>());

        PayoutDispatcher.Bank bank = payout -> {
            if (payout.sequence() == 1) {
                firstStarted.countDown();
                await(secondFinished);
            } else {
                await(firstStarted);
                completionOrder.add(payout.sequence());
                secondFinished.countDown();
                return;
            }
            completionOrder.add(payout.sequence());
        };

        try (PayoutDispatcher dispatcher = PayoutDispatcher.sharedPool(bank, 2)) {
            Future<?> first = dispatcher.submit(payout("merchant-7", 1));
            Future<?> second = dispatcher.submit(payout("merchant-7", 2));
            first.get(2, SECONDS);
            second.get(2, SECONDS);
        }

        assertEquals(List.of(2L, 1L), completionOrder);
    }

    @Test
    void keyedPartitionsPreserveMerchantOrderAndAllowBoundedConcurrency() throws Exception {
        String firstMerchant = "merchant-7";
        String secondMerchant = "merchant-8";
        assertNotEquals(
                Math.floorMod(firstMerchant.hashCode(), 2),
                Math.floorMod(secondMerchant.hashCode(), 2));

        CountDownLatch firstMerchantStarted = new CountDownLatch(1);
        CountDownLatch secondMerchantStarted = new CountDownLatch(1);
        Map<String, List<Long>> completionOrder = new ConcurrentHashMap<>();

        PayoutDispatcher.Bank bank = payout -> {
            if (payout.merchantId().equals(firstMerchant) && payout.sequence() == 1) {
                firstMerchantStarted.countDown();
                await(secondMerchantStarted);
            } else if (payout.merchantId().equals(secondMerchant)) {
                await(firstMerchantStarted);
                secondMerchantStarted.countDown();
            }
            completionOrder
                    .computeIfAbsent(
                            payout.merchantId(),
                            ignored -> Collections.synchronizedList(new ArrayList<>()))
                    .add(payout.sequence());
        };

        try (PayoutDispatcher dispatcher = PayoutDispatcher.partitioned(bank, 2)) {
            Future<?> first = dispatcher.submit(payout(firstMerchant, 1));
            Future<?> second = dispatcher.submit(payout(firstMerchant, 2));
            Future<?> otherMerchant = dispatcher.submit(payout(secondMerchant, 1));
            first.get(2, SECONDS);
            second.get(2, SECONDS);
            otherMerchant.get(2, SECONDS);
        }

        assertEquals(List.of(1L, 2L), completionOrder.get(firstMerchant));
        assertEquals(List.of(1L), completionOrder.get(secondMerchant));
    }

    private static PayoutDispatcher.Payout payout(String merchantId, long sequence) {
        return new PayoutDispatcher.Payout(merchantId, sequence, 10_00);
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(2, SECONDS)) {
                throw new IllegalStateException("concurrent test timed out");
            }
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("concurrent test was interrupted", failure);
        }
    }
}
