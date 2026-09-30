package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Modifier;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;

class SeatReservationsTest {
    @Test
    void serviceMonitorSerializesIndependentShows() throws Exception {
        CountDownLatch firstInside = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        CountDownLatch secondAttempted = new CountDownLatch(1);
        SeatReservations reservations = new SeatReservations((showId, seatId) -> {
            if (showId.equals("show-1")) {
                firstInside.countDown();
                await(releaseFirst);
            }
        });

        assertTrue(Modifier.isSynchronized(
                SeatReservations.class
                        .getMethod("reserve", String.class, String.class)
                        .getModifiers()));

        ExecutorService callers = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> first = callers.submit(
                    () -> reservations.reserve("show-1", "A1"));
            assertTrue(firstInside.await(2, SECONDS));

            Future<Boolean> second = callers.submit(() -> {
                secondAttempted.countDown();
                return reservations.reserve("show-2", "A1");
            });
            assertTrue(secondAttempted.await(2, SECONDS));
            assertFalse(second.isDone());

            releaseFirst.countDown();
            assertTrue(first.get(2, SECONDS));
            assertTrue(second.get(2, SECONDS));
        } finally {
            releaseFirst.countDown();
            callers.shutdownNow();
        }
    }

    @Test
    void perShowLocksAllowIndependentProgressAndKeepASeatExclusive() throws Exception {
        CountDownLatch firstInside = new CountDownLatch(1);
        CountDownLatch secondInside = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        SeatReservations reservations = new SeatReservations((showId, seatId) -> {
            if (showId.equals("show-1")) {
                firstInside.countDown();
                await(releaseFirst);
            } else if (showId.equals("show-2")) {
                secondInside.countDown();
            }
        });

        ExecutorService callers = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> first = callers.submit(
                    () -> reservations.reservePerShow("show-1", "A1"));
            assertTrue(firstInside.await(2, SECONDS));

            Future<Boolean> second = callers.submit(
                    () -> reservations.reservePerShow("show-2", "A1"));
            assertTrue(secondInside.await(2, SECONDS));
            assertTrue(second.get(2, SECONDS));

            releaseFirst.countDown();
            assertTrue(first.get(2, SECONDS));
        } finally {
            releaseFirst.countDown();
            callers.shutdownNow();
        }

        SeatReservations sameShow = new SeatReservations();
        CyclicBarrier startTogether = new CyclicBarrier(2);
        ExecutorService competitors = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> first = competitors.submit(
                    () -> reserveTogether(sameShow, startTogether));
            Future<Boolean> second = competitors.submit(
                    () -> reserveTogether(sameShow, startTogether));
            List<Boolean> results = List.of(
                    first.get(2, SECONDS), second.get(2, SECONDS));

            assertEquals(1L, results.stream().filter(Boolean::booleanValue).count());
            assertTrue(results.contains(false));
        } finally {
            competitors.shutdownNow();
        }
    }

    private static boolean reserveTogether(
            SeatReservations reservations,
            CyclicBarrier startTogether) {
        await(startTogether);
        return reservations.reservePerShow("show-3", "B7");
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

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(2, SECONDS);
        } catch (Exception failure) {
            throw new IllegalStateException("concurrent test did not reach its barrier", failure);
        }
    }
}
