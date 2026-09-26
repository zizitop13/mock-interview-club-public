package club.mockinterview.caching;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

public final class CacheAsideLoader {
    private final SharedCache cache;
    private final Origin origin;
    private final SingleFlightCoordinator coordinator;

    public CacheAsideLoader(
            SharedCache cache,
            Origin origin,
            SingleFlightCoordinator coordinator) {
        this.cache = cache;
        this.origin = origin;
        this.coordinator = coordinator;
    }

    public String get(String key) {
        return cache.get(key).orElseGet(() ->
                coordinator.execute(key, () ->
                        cache.get(key).orElseGet(() -> {
                            String loaded = origin.load(key);
                            cache.put(key, loaded);
                            return loaded;
                        })));
    }

    public interface SharedCache {
        Optional<String> get(String key);

        void put(String key, String value);
    }

    @FunctionalInterface
    public interface Origin {
        String load(String key);
    }

    @FunctionalInterface
    public interface SingleFlightCoordinator {
        String execute(String key, Supplier<String> loader);
    }

    public static final class JvmSingleFlight implements SingleFlightCoordinator {
        private final ConcurrentHashMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();

        @Override
        public String execute(String key, Supplier<String> loader) {
            ReentrantLock lock = locks.computeIfAbsent(key, ignored -> new ReentrantLock());
            lock.lock();
            try {
                return loader.get();
            } finally {
                lock.unlock();
            }
        }
    }
}
