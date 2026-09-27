package club.mockinterview.concurrency;

import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

public final class WalletReservations {
    private final ConcurrentHashMap<String, Long> available = new ConcurrentHashMap<>();
    private final Runnable afterUnsafeRead;

    public WalletReservations() {
        this(() -> { });
    }

    WalletReservations(Runnable afterUnsafeRead) {
        this.afterUnsafeRead = Objects.requireNonNull(afterUnsafeRead);
    }

    public void open(String walletId, long cents) {
        Objects.requireNonNull(walletId);
        if (cents < 0 || available.putIfAbsent(walletId, cents) != null) {
            throw new IllegalArgumentException("invalid wallet");
        }
    }

    public boolean reserveUnsafe(String walletId, long cents) {
        requirePositive(cents);
        long current = available.getOrDefault(walletId, 0L);
        afterUnsafeRead.run();
        if (current < cents) {
            return false;
        }
        available.put(walletId, current - cents);
        return true;
    }

    public boolean reserveAtomically(String walletId, long cents) {
        requirePositive(cents);
        AtomicBoolean reserved = new AtomicBoolean();
        available.compute(walletId, (id, current) -> {
            if (current == null || current < cents) {
                return current;
            }
            reserved.set(true);
            return current - cents;
        });
        return reserved.get();
    }

    public long available(String walletId) {
        return available.getOrDefault(walletId, 0L);
    }

    private static void requirePositive(long cents) {
        if (cents <= 0) {
            throw new IllegalArgumentException("invalid amount");
        }
    }
}
