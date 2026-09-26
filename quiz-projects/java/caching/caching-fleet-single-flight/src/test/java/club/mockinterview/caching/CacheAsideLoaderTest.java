package club.mockinterview.caching;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

class CacheAsideLoaderTest {
    @Test
    void processLocalSingleFlightAllowsOneOriginLoadPerInstance() throws Exception {
        CoordinatedCache cache = new CoordinatedCache();
        AtomicInteger originLoads = new AtomicInteger();
        CyclicBarrier bothLoadsStarted = new CyclicBarrier(2);
        CacheAsideLoader.Origin origin = key -> {
            originLoads.incrementAndGet();
            await(bothLoadsStarted);
            return "product-42";
        };

        CacheAsideLoader instanceA = new CacheAsideLoader(
                cache, origin, new CacheAsideLoader.JvmSingleFlight());
        CacheAsideLoader instanceB = new CacheAsideLoader(
                cache, origin, new CacheAsideLoader.JvmSingleFlight());

        assertEquals(List.of("product-42", "product-42"), callTogether(instanceA, instanceB));
        assertEquals(2, originLoads.get());
    }

    @Test
    void sharedSingleFlightAndRecheckCollapseTheFleetLoad() throws Exception {
        CoordinatedCache cache = new CoordinatedCache();
        AtomicInteger originLoads = new AtomicInteger();
        CacheAsideLoader.Origin origin = key -> {
            originLoads.incrementAndGet();
            return "product-42";
        };
        CacheAsideLoader.JvmSingleFlight sharedCoordinator =
                new CacheAsideLoader.JvmSingleFlight();

        CacheAsideLoader instanceA = new CacheAsideLoader(cache, origin, sharedCoordinator);
        CacheAsideLoader instanceB = new CacheAsideLoader(cache, origin, sharedCoordinator);

        assertEquals(List.of("product-42", "product-42"), callTogether(instanceA, instanceB));
        assertEquals(1, originLoads.get());
    }

    private static List<String> callTogether(
            CacheAsideLoader instanceA,
            CacheAsideLoader instanceB) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<String> first = pool.submit(() -> instanceA.get("product:42"));
            Future<String> second = pool.submit(() -> instanceB.get("product:42"));
            return List.of(first.get(2, SECONDS), second.get(2, SECONDS));
        } finally {
            pool.shutdownNow();
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(2, SECONDS);
        } catch (Exception failure) {
            throw new IllegalStateException("concurrent test did not reach its barrier", failure);
        }
    }

    private static final class CoordinatedCache implements CacheAsideLoader.SharedCache {
        private final ConcurrentHashMap<String, String> values = new ConcurrentHashMap<>();
        private final AtomicInteger reads = new AtomicInteger();
        private final CyclicBarrier initialReads = new CyclicBarrier(2);

        @Override
        public Optional<String> get(String key) {
            if (reads.incrementAndGet() <= 2) {
                String snapshot = values.get(key);
                await(initialReads);
                return Optional.ofNullable(snapshot);
            }
            return Optional.ofNullable(values.get(key));
        }

        @Override
        public void put(String key, String value) {
            values.put(key, value);
        }
    }
}
