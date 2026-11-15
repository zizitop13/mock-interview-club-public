package club.mockinterview.concurrency;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

public final class CallerRunsBackpressure {
    public boolean overflowRunsOnSubmittingThread() throws InterruptedException {
        Thread submittingThread = Thread.currentThread();
        AtomicReference<Thread> executedBy = new AtomicReference<>();
        CountDownLatch releaseWorker = new CountDownLatch(1);
        ThreadPoolExecutor executor = executor(new ThreadPoolExecutor.CallerRunsPolicy());

        try {
            saturate(executor, releaseWorker);
            executor.execute(() -> executedBy.set(Thread.currentThread()));
            return executedBy.get() == submittingThread;
        } finally {
            releaseWorker.countDown();
            executor.shutdownNow();
        }
    }

    public boolean explicitRejectionKeepsWorkOffSubmittingThread() throws InterruptedException {
        AtomicBoolean overflowRan = new AtomicBoolean();
        CountDownLatch releaseWorker = new CountDownLatch(1);
        ThreadPoolExecutor executor = executor(new ThreadPoolExecutor.AbortPolicy());

        try {
            saturate(executor, releaseWorker);
            try {
                executor.execute(() -> overflowRan.set(true));
                return false;
            } catch (RejectedExecutionException expected) {
                return !overflowRan.get();
            }
        } finally {
            releaseWorker.countDown();
            executor.shutdownNow();
        }
    }

    private static ThreadPoolExecutor executor(
            java.util.concurrent.RejectedExecutionHandler rejectionHandler) {
        return new ThreadPoolExecutor(
                1,
                1,
                0,
                TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(1),
                rejectionHandler);
    }

    private static void saturate(
            ThreadPoolExecutor executor,
            CountDownLatch releaseWorker) throws InterruptedException {
        CountDownLatch workerStarted = new CountDownLatch(1);
        executor.execute(() -> {
            workerStarted.countDown();
            await(releaseWorker);
        });
        workerStarted.await();
        executor.execute(() -> { });
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
