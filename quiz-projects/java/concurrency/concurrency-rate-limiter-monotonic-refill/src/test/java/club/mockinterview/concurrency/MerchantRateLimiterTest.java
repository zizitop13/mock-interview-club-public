package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class MerchantRateLimiterTest {
    @Test
    void wallClockJumpCanRefillWithoutElapsedDuration() {
        AtomicLong wallClockMillis = new AtomicLong(1_000);
        MerchantRateLimiter limiter = MerchantRateLimiter.usingWallClock(
                1,
                wallClockMillis::get);

        assertTrue(limiter.allow());
        assertFalse(limiter.allow());

        wallClockMillis.addAndGet(60_000);

        assertTrue(limiter.allow());
    }

    @Test
    void monotonicTickerRefillsOnlyAfterAnElapsedPeriod() {
        AtomicLong elapsedNanos = new AtomicLong();
        MerchantRateLimiter limiter = MerchantRateLimiter.usingMonotonicTicker(
                1,
                elapsedNanos::get);

        assertTrue(limiter.allow());
        assertFalse(limiter.allow());

        elapsedNanos.addAndGet(MerchantRateLimiter.REFILL_PERIOD_NANOS - 1);
        assertFalse(limiter.allow());

        elapsedNanos.incrementAndGet();
        assertTrue(limiter.allow());
    }
}
