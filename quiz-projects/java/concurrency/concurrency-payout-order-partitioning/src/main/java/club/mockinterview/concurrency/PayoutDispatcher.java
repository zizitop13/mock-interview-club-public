package club.mockinterview.concurrency;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.ToIntFunction;
import java.util.stream.IntStream;

public final class PayoutDispatcher implements AutoCloseable {
    private final Bank bank;
    private final List<ExecutorService> workers;
    private final ToIntFunction<Payout> route;

    private PayoutDispatcher(
            Bank bank,
            List<ExecutorService> workers,
            ToIntFunction<Payout> route) {
        this.bank = Objects.requireNonNull(bank);
        this.workers = List.copyOf(workers);
        this.route = route;
    }

    public static PayoutDispatcher sharedPool(Bank bank, int threadCount) {
        if (threadCount <= 0) {
            throw new IllegalArgumentException("threadCount must be positive");
        }
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        return new PayoutDispatcher(bank, List.of(pool), ignored -> 0);
    }

    public static PayoutDispatcher partitioned(Bank bank, int partitionCount) {
        if (partitionCount <= 0) {
            throw new IllegalArgumentException("partitionCount must be positive");
        }
        List<ExecutorService> partitions = IntStream.range(0, partitionCount)
                .mapToObj(ignored -> Executors.newSingleThreadExecutor())
                .toList();
        return new PayoutDispatcher(
                bank,
                partitions,
                payout -> Math.floorMod(
                        payout.merchantId().hashCode(), partitions.size()));
    }

    public Future<?> submit(Payout payout) {
        Objects.requireNonNull(payout);
        return workers.get(route.applyAsInt(payout))
                .submit(() -> bank.send(payout));
    }

    @Override
    public void close() {
        workers.forEach(ExecutorService::shutdown);
    }

    public record Payout(String merchantId, long sequence, long cents) {
        public Payout {
            Objects.requireNonNull(merchantId);
            if (sequence <= 0 || cents <= 0) {
                throw new IllegalArgumentException("sequence and cents must be positive");
            }
        }
    }

    @FunctionalInterface
    public interface Bank {
        void send(Payout payout);
    }
}
