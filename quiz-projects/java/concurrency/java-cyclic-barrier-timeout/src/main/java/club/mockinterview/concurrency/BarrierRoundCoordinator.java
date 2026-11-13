package club.mockinterview.concurrency;

import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public final class BarrierRoundCoordinator {
    public boolean reuseAfterTimeoutCompletes() throws InterruptedException {
        CyclicBarrier sharedAcrossRounds = new CyclicBarrier(2);
        expire(sharedAcrossRounds);

        try {
            sharedAcrossRounds.await();
            return true;
        } catch (BrokenBarrierException broken) {
            return false;
        }
    }

    public boolean freshBarrierCompletesNextRound()
            throws InterruptedException, ExecutionException {
        CyclicBarrier failedRound = new CyclicBarrier(2);
        expire(failedRound);

        CyclicBarrier nextRound = new CyclicBarrier(2);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> await(nextRound));
            var second = executor.submit(() -> await(nextRound));
            first.get();
            second.get();
        }
        return !nextRound.isBroken();
    }

    private static void expire(CyclicBarrier barrier) throws InterruptedException {
        try {
            barrier.await(0, TimeUnit.NANOSECONDS);
            throw new AssertionError("barrier unexpectedly opened");
        } catch (TimeoutException expected) {
            // With one missing party, zero timeout deterministically breaks this generation.
        } catch (BrokenBarrierException unexpected) {
            throw new AssertionError("new barrier was already broken", unexpected);
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(interrupted);
        } catch (BrokenBarrierException broken) {
            throw new IllegalStateException(broken);
        }
    }
}
