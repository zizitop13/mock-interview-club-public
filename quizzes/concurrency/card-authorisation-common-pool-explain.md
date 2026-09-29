# Isolating blocking card authorisations from the common pool

## Correct answer

d. Pass a dedicated bounded executor to `supplyAsync` and handle rejected submissions.

## Detailed explanation

The resource invariant is: slow issuer calls may consume only the concurrency and backlog explicitly allocated to card authorisation; they must not exhaust workers shared with unrelated asynchronous work.

Under the stated server assumption, `CompletableFuture.supplyAsync` without an executor schedules the blocking supplier on `ForkJoinPool.commonPool()`. Fork/join workers are shared process-wide and are primarily suited to short, CPU-bound tasks that cooperate with the pool. If issuer calls block, enough concurrent authorisations can occupy those workers and delay unrelated common-pool stages.

A dedicated `ThreadPoolExecutor` creates a bulkhead. Its fixed worker count bounds concurrent calls to the issuer, its bounded queue limits waiting work and memory use, and its rejection policy exposes overload when both capacities are full. The service can convert rejection into a failed future and let the API return an explicit overload response or apply a deliberate retry policy.

The executor size and queue capacity should be chosen from the issuer's concurrency limit, the service latency budget, and measured call duration. This does not make a timed-out issuer call disappear; transport-level deadlines and cancellation behavior are separate concerns.

## Code example

```java
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public final class CardAuthorizer implements AutoCloseable {
    private final Issuer issuer;
    private final ThreadPoolExecutor issuerIo = new ThreadPoolExecutor(
        16, 16, 0, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(100),
        new ThreadPoolExecutor.AbortPolicy());

    public CardAuthorizer(Issuer issuer) {
        this.issuer = issuer;
    }

    public CompletableFuture<Decision> authorize(Request request) {
        try {
            return CompletableFuture.supplyAsync(
                () -> issuer.authorize(request), issuerIo);
        } catch (RejectedExecutionException overloaded) {
            return CompletableFuture.failedFuture(overloaded);
        }
    }

    @Override
    public void close() {
        issuerIo.shutdown();
    }
}
```

The runnable proof records that the original supplier runs in the common fork/join pool. Its fix test saturates a one-worker, one-slot issuer executor, verifies that the third request is rejected, and confirms accepted calls run only on the dedicated issuer thread.

## Why the other options are incorrect

- a. `thenApplyAsync` changes where a later stage runs; it does not move the blocking supplier off the common-pool worker.
- b. `runAsync` also uses the common pool when no executor is supplied, and it discards the supplier's return value.
- c. Raising global parallelism adds shared workers but does not isolate issuer load or bound its backlog, so overload can still affect unrelated work.
