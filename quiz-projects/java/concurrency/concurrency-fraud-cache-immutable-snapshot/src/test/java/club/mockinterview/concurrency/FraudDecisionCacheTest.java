package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;

class FraudDecisionCacheTest {
    @Test
    void inPlaceRefreshExposesAStateFromNeitherCompleteSnapshot() throws Exception {
        CountDownLatch boundaryReached = new CountDownLatch(1);
        CountDownLatch resumeRefresh = new CountDownLatch(1);
        FraudDecisionCache cache = FraudDecisionCache.usingMutableMap(
                Map.of("card-42", 90),
                pauseAtBoundary(boundaryReached, resumeRefresh));
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            Future<?> refresh = executor.submit(() -> cache.refresh(Map.of(
                    "card-42", 90,
                    "card-84", 95)));

            assertTrue(boundaryReached.await(1, SECONDS));
            assertFalse(cache.shouldBlock("card-42"));

            resumeRefresh.countDown();
            refresh.get(1, SECONDS);
            assertTrue(cache.shouldBlock("card-42"));
        } finally {
            resumeRefresh.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void immutableReplacementKeepsACompleteSnapshotVisible() throws Exception {
        CountDownLatch boundaryReached = new CountDownLatch(1);
        CountDownLatch publishSnapshot = new CountDownLatch(1);
        FraudDecisionCache cache = FraudDecisionCache.usingImmutableSnapshots(
                Map.of("card-42", 90),
                pauseAtBoundary(boundaryReached, publishSnapshot));
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            Future<?> refresh = executor.submit(() -> cache.refresh(Map.of(
                    "card-42", 90,
                    "card-84", 95)));

            assertTrue(boundaryReached.await(1, SECONDS));
            assertTrue(cache.shouldBlock("card-42"));
            assertFalse(cache.shouldBlock("card-84"));

            publishSnapshot.countDown();
            refresh.get(1, SECONDS);
            assertTrue(cache.shouldBlock("card-42"));
            assertTrue(cache.shouldBlock("card-84"));
        } finally {
            publishSnapshot.countDown();
            executor.shutdownNow();
        }
    }

    private static Runnable pauseAtBoundary(
            CountDownLatch boundaryReached,
            CountDownLatch resumeRefresh) {
        return () -> {
            boundaryReached.countDown();
            try {
                if (!resumeRefresh.await(1, SECONDS)) {
                    throw new AssertionError("refresh was not resumed");
                }
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new AssertionError(interrupted);
            }
        };
    }
}
