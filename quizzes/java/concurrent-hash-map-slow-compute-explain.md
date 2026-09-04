# Slow computeIfAbsent mapping functions and bin contention

## Correct answer

d. A slow mapping function can block updates for other keys that occupy the same bin.

## Detailed explanation

`ConcurrentHashMap.computeIfAbsent` is useful because the absence check, computation, and insertion behave as one atomic operation for the requested key. It prevents callers from independently installing different values for that key.

That guarantee requires coordination inside the map. While the mapping function is being computed, some updates involving the same internal bin can be blocked. Two unequal keys may still occupy that bin because their spread hashes map to the same table index. If the mapping function performs a slow network call, a tenant that has no logical relationship to the requested tenant can wait behind it. A poor or adversarial `hashCode()` makes this much easier to trigger, but ordinary collisions and resize timing can expose it too.

The Java API documentation therefore requires the computation to be short and simple and warns that some attempted updates may be blocked. `ConcurrentHashMap` does not use one global lock, so activity in other bins can continue, but bin-level serialization is enough to damage tail latency.

A common solution is to store a lightweight placeholder atomically and perform slow work after the map operation. A `CompletableFuture<Token>` can represent the one in-flight load so concurrent callers for the same key share it without holding map coordination during remote I/O. Failures should remove only the exact failed placeholder, allowing a later call to retry.

## Code example

```java
final class TokenCache {
    private final ConcurrentHashMap<TenantKey, CompletableFuture<Token>> tokens =
        new ConcurrentHashMap<>();
    private final AuthClient authClient;

    Token tokenFor(TenantKey key) {
        CompletableFuture<Token> created = new CompletableFuture<>();
        CompletableFuture<Token> existing = tokens.putIfAbsent(key, created);

        if (existing != null) {
            return existing.join();
        }

        try {
            Token token = authClient.fetchToken(key);
            created.complete(token);
            return token;
        } catch (Throwable failure) {
            created.completeExceptionally(failure);
            tokens.remove(key, created);
            throw new CompletionException(failure);
        }
    }
}
```

Only `putIfAbsent` executes inside the map's update path. The winning caller performs the remote request afterward, while callers for the same key wait on its future. The conditional `remove(key, created)` cannot delete a newer replacement installed by another caller.

For production code, exception handling should preserve checked exceptions appropriately, waiting should have a timeout, and cancellation policy should be explicit. A mature cache library with asynchronous loading may be preferable.

## Why the other options are incorrect

- a. For an established mapping, `computeIfAbsent` applies the function at most once per key for that invocation path. The issue here is blocking caused by the long computation, not duplicate concurrent execution for one key.
- b. `ConcurrentHashMap` has no single global lock for all reads and writes, and an ordinary cache hit does not keep a lock until the caller finishes using the value.
- c. A successfully installed value is safely published through the concurrent map. Later readers do not need an extra volatile field or external lock to observe the constructed token.
