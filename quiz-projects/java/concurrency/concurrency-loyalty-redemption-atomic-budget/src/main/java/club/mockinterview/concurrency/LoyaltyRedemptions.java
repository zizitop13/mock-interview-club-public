package club.mockinterview.concurrency;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;

public final class LoyaltyRedemptions {
    private final long dailyBudget;
    private final LongAdder unsafeRedeemed = new LongAdder();
    private final AtomicLong atomicRedeemed = new AtomicLong();
    private final Runnable afterUnsafeRead;

    public LoyaltyRedemptions(long dailyBudget) {
        this(dailyBudget, () -> { });
    }

    LoyaltyRedemptions(long dailyBudget, Runnable afterUnsafeRead) {
        if (dailyBudget <= 0) {
            throw new IllegalArgumentException("invalid budget");
        }
        this.dailyBudget = dailyBudget;
        this.afterUnsafeRead = Objects.requireNonNull(afterUnsafeRead);
    }

    public boolean redeemUnsafe(long points) {
        requirePositive(points);
        long current = unsafeRedeemed.sum();
        afterUnsafeRead.run();
        if (points > dailyBudget - current) {
            return false;
        }
        unsafeRedeemed.add(points);
        return true;
    }

    public boolean redeemAtomically(long points) {
        requirePositive(points);
        while (true) {
            long current = atomicRedeemed.get();
            if (points > dailyBudget - current) {
                return false;
            }
            if (atomicRedeemed.compareAndSet(current, current + points)) {
                return true;
            }
        }
    }

    public long unsafeRedeemedPoints() {
        return unsafeRedeemed.sum();
    }

    public long atomicallyRedeemedPoints() {
        return atomicRedeemed.get();
    }

    private static void requirePositive(long points) {
        if (points <= 0) {
            throw new IllegalArgumentException("invalid points");
        }
    }
}
