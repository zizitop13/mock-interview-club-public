package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;

class TradingQuoteCacheTest {
    @Test
    void delayedOlderPublishCanOverwriteANewerQuote() throws Exception {
        CountDownLatch olderReady = new CountDownLatch(1);
        CountDownLatch releaseOlder = new CountDownLatch(1);
        TradingQuoteCache cache = new TradingQuoteCache(quote -> {
            if (quote.sequence() == 41) {
                olderReady.countDown();
                await(releaseOlder);
            }
        });
        TradingQuoteCache.Quote older =
                new TradingQuoteCache.Quote(41, 101_000_000);
        TradingQuoteCache.Quote newer =
                new TradingQuoteCache.Quote(42, 102_000_000);

        ExecutorService worker = Executors.newSingleThreadExecutor();
        try {
            Future<?> delayed = worker.submit(
                    () -> cache.publishUnconditionally(older));
            await(olderReady);
            cache.publishUnconditionally(newer);
            releaseOlder.countDown();
            delayed.get(2, SECONDS);
        } finally {
            worker.shutdownNow();
        }

        assertEquals(older, cache.current());
    }

    @Test
    void atomicAccumulatorRetainsTheHighestSequence() throws Exception {
        CyclicBarrier startTogether = new CyclicBarrier(2);
        TradingQuoteCache cache = new TradingQuoteCache();
        TradingQuoteCache.Quote older =
                new TradingQuoteCache.Quote(41, 101_000_000);
        TradingQuoteCache.Quote newer =
                new TradingQuoteCache.Quote(42, 102_000_000);

        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = workers.submit(() -> {
                await(startTogether);
                cache.publishHighest(older);
            });
            Future<?> second = workers.submit(() -> {
                await(startTogether);
                cache.publishHighest(newer);
            });
            first.get(2, SECONDS);
            second.get(2, SECONDS);
        } finally {
            workers.shutdownNow();
        }

        assertEquals(newer, cache.current());
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(2, SECONDS)) {
                throw new IllegalStateException("concurrent test timed out");
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("concurrent test interrupted", interrupted);
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
