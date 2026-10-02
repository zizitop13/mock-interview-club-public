package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;

class LoyaltyRedemptionsTest {
    @Test
    void longAdderCheckThenAddCanAcceptMoreThanTheBudget() throws Exception {
        CyclicBarrier bothTotalsRead = new CyclicBarrier(2);
        LoyaltyRedemptions redemptions =
                new LoyaltyRedemptions(100, () -> await(bothTotalsRead));

        List<Boolean> results = callTogether(
                () -> redemptions.redeemUnsafe(60),
                () -> redemptions.redeemUnsafe(60));

        assertEquals(List.of(true, true), results);
        assertEquals(120, redemptions.unsafeRedeemedPoints());
    }

    @Test
    void casLoopKeepsSuccessfulRedemptionsWithinTheBudget() throws Exception {
        CyclicBarrier startTogether = new CyclicBarrier(2);
        LoyaltyRedemptions redemptions = new LoyaltyRedemptions(100);

        List<Boolean> results = callTogether(
                () -> redeemTogether(redemptions, startTogether),
                () -> redeemTogether(redemptions, startTogether));

        assertEquals(1L, results.stream().filter(Boolean::booleanValue).count());
        assertTrue(results.contains(false));
        assertEquals(60, redemptions.atomicallyRedeemedPoints());
    }

    private static boolean redeemTogether(
            LoyaltyRedemptions redemptions,
            CyclicBarrier startTogether) {
        await(startTogether);
        return redemptions.redeemAtomically(60);
    }

    private static <T> List<T> callTogether(
            Callable<T> first,
            Callable<T> second) throws Exception {
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<T> firstResult = workers.submit(first);
            Future<T> secondResult = workers.submit(second);
            return List.of(
                    firstResult.get(2, SECONDS),
                    secondResult.get(2, SECONDS));
        } finally {
            workers.shutdownNow();
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(2, SECONDS);
        } catch (Exception failure) {
            throw new IllegalStateException("concurrent test did not reach its barrier", failure);
        }
    }
}
