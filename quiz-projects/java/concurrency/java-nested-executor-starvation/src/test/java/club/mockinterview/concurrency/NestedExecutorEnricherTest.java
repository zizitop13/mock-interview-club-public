package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadPoolExecutor;
import org.junit.jupiter.api.Test;

class NestedExecutorEnricherTest {
    private final NestedExecutorEnricher sut = new NestedExecutorEnricher();

    @Test
    void nestedTasksQueueBehindParentsThatWaitForThem() throws Exception {
        ThreadPoolExecutor executor = (ThreadPoolExecutor) Executors.newFixedThreadPool(2);
        try {
            List<CompletableFuture<String>> results =
                    sut.broken(List.of("a", "b"), executor, String::toUpperCase);

            awaitQueueSize(executor, 2);
            assertFalse(results.get(0).isDone());
            assertFalse(results.get(1).isDone());

            List<Runnable> childTasks = new ArrayList<>();
            executor.getQueue().drainTo(childTasks);
            childTasks.forEach(Runnable::run);

            CompletableFuture.allOf(results.toArray(CompletableFuture[]::new)).join();
            assertEquals(List.of("A", "B"), results.stream().map(CompletableFuture::join).toList());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void oneTaskPerFetchCompletesWithTheSameBoundedPool() {
        ThreadPoolExecutor executor = (ThreadPoolExecutor) Executors.newFixedThreadPool(2);
        try {
            List<CompletableFuture<String>> results =
                    sut.fixed(List.of("a", "b", "c", "d"), executor, String::toUpperCase);

            CompletableFuture.allOf(results.toArray(CompletableFuture[]::new)).join();
            assertEquals(
                    List.of("A", "B", "C", "D"),
                    results.stream().map(CompletableFuture::join).toList());
        } finally {
            executor.shutdownNow();
        }
    }

    private static void awaitQueueSize(ThreadPoolExecutor executor, int expected) throws Exception {
        long deadline = System.nanoTime() + Duration.ofSeconds(2).toNanos();
        while (executor.getQueue().size() < expected && System.nanoTime() < deadline) {
            Thread.onSpinWait();
        }
        assertEquals(expected, executor.getQueue().size());
    }
}
