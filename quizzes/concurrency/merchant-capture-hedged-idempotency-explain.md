# Reusing one idempotency key across hedged capture attempts

## Correct answer

b. Accept one idempotency key for the request and reuse it for primary and hedge.

## Detailed explanation

The hidden problem is that the hedge is not a retry of the same logical operation from the processor's point of view. Each attempt gets a new UUID, and the stated processor contract treats different idempotency keys as independent capture requests. If the primary is merely slow and both HTTP calls are accepted, both may commit a capture even though `applyToEither` exposes only the first response.

The business invariant is: one logical merchant capture request creates at most one processor capture, and every attempt for that request replays the same receipt. The idempotency key is therefore request identity, not attempt identity. Accept or derive it once at the request boundary and reuse it for the primary, hedge, and any later retry. The processor can then collapse concurrent attempts and return its stable result for that key.

Cancellation is not the correctness boundary. After a remote server accepts a request, cancelling the local future may only stop local waiting; it cannot reliably undo a committed remote effect.

## Code example

```java
public CompletableFuture<Receipt> capture(
        Payment payment, String idempotencyKey) {
    CompletableFuture<Receipt> primary =
            processor.capture(payment, idempotencyKey);

    CompletableFuture<Receipt> hedge = CompletableFuture
            .runAsync(() -> {}, CompletableFuture.delayedExecutor(
                    100, TimeUnit.MILLISECONDS))
            .thenCompose(ignored ->
                    processor.capture(payment, idempotencyKey));

    return primary.applyToEither(hedge, Function.identity());
}
```

The processor must enforce the documented idempotency contract durably; the Java service supplies the same operation identity to every concurrent attempt.

## Why the other options are incorrect

- a. Cancelling a future does not guarantee that an already accepted HTTP request stops before its remote side effect, and different keys still authorize two captures.
- c. Synchronizing local future creation only changes submission order. The processor still sees two independent keys and may execute both requests.
- d. Virtual threads change where delayed or blocking work runs; they do not relate two remote requests or provide idempotency.
