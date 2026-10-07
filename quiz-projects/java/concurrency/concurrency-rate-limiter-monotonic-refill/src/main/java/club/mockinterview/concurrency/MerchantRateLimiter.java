package club.mockinterview.concurrency;

import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

public final class MerchantRateLimiter {
    static final long REFILL_PERIOD_MILLIS = 100;
    static final long REFILL_PERIOD_NANOS = TimeUnit.MILLISECONDS.toNanos(100);

    private final int capacity;
    private final LongSupplier ticker;
    private final long refillPeriod;
    private int tokens;
    private long lastRefill;

    public MerchantRateLimiter(int capacity) {
        this(capacity, System::currentTimeMillis, REFILL_PERIOD_MILLIS);
    }

    private MerchantRateLimiter(
            int capacity,
            LongSupplier ticker,
            long refillPeriod) {
        if (capacity <= 0) {
            throw new IllegalArgumentException("capacity must be positive");
        }
        this.capacity = capacity;
        this.ticker = ticker;
        this.refillPeriod = refillPeriod;
        this.tokens = capacity;
        this.lastRefill = ticker.getAsLong();
    }

    public static MerchantRateLimiter withMonotonicTicker(int capacity) {
        return new MerchantRateLimiter(
                capacity,
                System::nanoTime,
                REFILL_PERIOD_NANOS);
    }

    static MerchantRateLimiter usingWallClock(
            int capacity,
            LongSupplier wallClock) {
        return new MerchantRateLimiter(
                capacity,
                wallClock,
                REFILL_PERIOD_MILLIS);
    }

    static MerchantRateLimiter usingMonotonicTicker(
            int capacity,
            LongSupplier ticker) {
        return new MerchantRateLimiter(
                capacity,
                ticker,
                REFILL_PERIOD_NANOS);
    }

    public synchronized boolean allow() {
        long now = ticker.getAsLong();
        long periods = (now - lastRefill) / refillPeriod;

        if (periods > 0) {
            tokens = (int) Math.min(capacity, tokens + periods);
            lastRefill += periods * refillPeriod;
        }

        if (tokens == 0) {
            return false;
        }
        tokens--;
        return true;
    }
}
