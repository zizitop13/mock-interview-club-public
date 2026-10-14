# Keeping blocking SQL off a broker callback thread

## Correct answer

a. Run each audit with `thenAcceptAsync` on an owned virtual-thread executor.

## Detailed explanation

The hidden problem is the execution policy of a non-async `CompletableFuture` stage. Under the stated bounded-batch and thread-safe-store assumptions, the sends themselves are safe. But when an incomplete send future is completed by the broker's I/O thread, its `thenAccept` action normally runs inline on that same thread. The blocking SQL audit therefore prevents that thread from completing later broker acknowledgements. Under load, unrelated sends can time out or appear stuck even though the broker has already acknowledged them.

The business invariant is: processing one acknowledgement must not prevent the broker I/O thread from delivering other acknowledgements, while `publish` must still complete only after every required audit write finishes. `thenAcceptAsync` preserves the dependency between a send and its audit but schedules the blocking stage elsewhere. An executor owned by this service isolates the work from unrelated asynchronous pipelines; virtual threads are appropriate because each audit spends most of its time waiting for JDBC I/O.

The SQL connection pool remains the database-capacity boundary. Virtual threads make blocking waits cheaper, but they do not create extra database capacity or remove the need for normal connection-pool sizing.

## Code example

```java
private final ExecutorService auditIo =
        Executors.newVirtualThreadPerTaskExecutor();

public CompletableFuture<Void> publish(List<Payout> payouts) {
    CompletableFuture<?>[] completions = payouts.stream()
            .map(payout -> broker.send(payout)
                    .thenAcceptAsync(ack -> audit.save(
                            payout.id(), ack.offset()), auditIo))
            .toArray(CompletableFuture<?>[]::new);
    return CompletableFuture.allOf(completions);
}

@Override
public void close() {
    auditIo.close();
}
```

## Why the other options are incorrect

- b. `parallelStream` may submit sends from several caller-side workers, but each non-async completion action still runs on the thread that completes its future.
- c. The no-argument async method uses the common pool by default, so slow SQL competes with unrelated application work instead of receiving an explicit, owned I/O policy.
- d. Joining each send serializes the batch and blocks the caller. It avoids overlap by discarding useful broker concurrency rather than isolating the blocking audit stage.
