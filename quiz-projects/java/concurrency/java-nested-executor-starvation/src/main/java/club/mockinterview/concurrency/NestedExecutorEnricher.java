package club.mockinterview.concurrency;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.function.Function;

public final class NestedExecutorEnricher {
    public List<CompletableFuture<String>> broken(
            List<String> ids,
            Executor executor,
            Function<String, String> fetch) {
        CountDownLatch outerTasksStarted = new CountDownLatch(ids.size());

        return ids.stream()
                .map(id -> CompletableFuture.supplyAsync(() -> {
                    outerTasksStarted.countDown();
                    await(outerTasksStarted);
                    return CompletableFuture
                            .supplyAsync(() -> fetch.apply(id), executor)
                            .join();
                }, executor))
                .toList();
    }

    public List<CompletableFuture<String>> fixed(
            List<String> ids,
            Executor executor,
            Function<String, String> fetch) {
        return ids.stream()
                .map(id -> CompletableFuture.supplyAsync(() -> fetch.apply(id), executor))
                .toList();
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new CompletionException(interrupted);
        }
    }
}
