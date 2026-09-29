package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.ForkJoinTask;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;

class CardAuthorizerTest {
    @Test
    void blockingIssuerRunsOnTheSharedCommonPool() throws Exception {
        CountDownLatch issuerStarted = new CountDownLatch(1);
        CountDownLatch releaseIssuer = new CountDownLatch(1);
        AtomicReference<ForkJoinPool> observedPool = new AtomicReference<>();
        CardAuthorizer authorizer = new CardAuthorizer(request -> {
            observedPool.set(ForkJoinTask.getPool());
            issuerStarted.countDown();
            await(releaseIssuer);
            return CardAuthorizer.Decision.APPROVED;
        });

        CompletableFuture<CardAuthorizer.Decision> result =
                authorizer.authorizeOnCommonPool(request("card-1"));
        try {
            assertTrue(issuerStarted.await(2, SECONDS));
            assertSame(ForkJoinPool.commonPool(), observedPool.get());
            assertFalse(result.isDone());
        } finally {
            releaseIssuer.countDown();
        }
        assertEquals(CardAuthorizer.Decision.APPROVED, result.get(2, SECONDS));
    }

    @Test
    void boundedIssuerPoolIsolatesWorkersAndRejectsExcessBacklog() throws Exception {
        CountDownLatch firstStarted = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        AtomicReference<ForkJoinPool> observedPool = new AtomicReference<>();
        AtomicReference<String> observedThread = new AtomicReference<>();

        CardAuthorizer authorizer = new CardAuthorizer(request -> {
            observedPool.set(ForkJoinTask.getPool());
            observedThread.set(Thread.currentThread().getName());
            if (request.cardId().equals("card-1")) {
                firstStarted.countDown();
                await(releaseFirst);
            }
            return CardAuthorizer.Decision.APPROVED;
        });

        ThreadPoolExecutor issuerIo = new ThreadPoolExecutor(
                1,
                1,
                0,
                SECONDS,
                new ArrayBlockingQueue<>(1),
                task -> new Thread(task, "issuer-io-1"),
                new ThreadPoolExecutor.AbortPolicy());
        try {
            CompletableFuture<CardAuthorizer.Decision> first =
                    authorizer.authorizeOn(request("card-1"), issuerIo);
            assertTrue(firstStarted.await(2, SECONDS));

            CompletableFuture<CardAuthorizer.Decision> queued =
                    authorizer.authorizeOn(request("card-2"), issuerIo);
            CompletableFuture<CardAuthorizer.Decision> rejected =
                    authorizer.authorizeOn(request("card-3"), issuerIo);

            ExecutionException failure = assertThrows(
                    ExecutionException.class,
                    () -> rejected.get(2, SECONDS));
            assertInstanceOf(RejectedExecutionException.class, failure.getCause());

            releaseFirst.countDown();
            assertEquals(
                    List.of(
                            CardAuthorizer.Decision.APPROVED,
                            CardAuthorizer.Decision.APPROVED),
                    List.of(first.get(2, SECONDS), queued.get(2, SECONDS)));
            assertNull(observedPool.get());
            assertEquals("issuer-io-1", observedThread.get());
        } finally {
            releaseFirst.countDown();
            issuerIo.shutdownNow();
        }
    }

    private static CardAuthorizer.Request request(String cardId) {
        return new CardAuthorizer.Request(cardId, 10_00);
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(2, SECONDS)) {
                throw new IllegalStateException("issuer call timed out");
            }
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("issuer call was interrupted", failure);
        }
    }
}
