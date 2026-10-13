# Holding an HTTP bulkhead until asynchronous I/O completes

## Correct answer

c. Release on future completion, also releasing if `fetch` throws synchronously.

## Detailed explanation

The hidden problem is that the `try` block covers only asynchronous request submission. `gateway.fetch(pair)` returns a `CompletableFuture` while the HTTP exchange is still in flight, so `finally` immediately returns the permit. Twenty permits therefore limit how many callers can enter a very short submission section, not how many requests can concurrently consume provider, socket, and connection-pool capacity.

The business invariant is: each in-flight provider request owns exactly one bulkhead permit from immediately before submission until that request completes. The permit must be released for normal completion and asynchronous failure. If `fetch` throws before it can return a future, that path must release the already-acquired permit separately.

Attach the normal release to the future representing the HTTP operation. This keeps the asynchronous API and its concurrency while making the semaphore lifetime match the resource lifetime. If a completed future is returned, `whenComplete` runs immediately, which is correct because no request remains in flight.

## Code example

```java
public CompletableFuture<BigDecimal> quote(String pair)
        throws InterruptedException {
    providerSlots.acquire();
    try {
        CompletableFuture<BigDecimal> request = gateway.fetch(pair);
        return request.whenComplete(
                (rate, failure) -> providerSlots.release());
    } catch (RuntimeException | Error submissionFailure) {
        providerSlots.release();
        throw submissionFailure;
    }
}
```

The future returned by `whenComplete` preserves the rate or asynchronous failure for the caller; the callback's only responsibility is returning the permit.

## Why the other options are incorrect

- a. Acquiring in `thenApply` happens after the HTTP result arrives, so it cannot bound the request while it consumes remote and local I/O capacity.
- b. Changing the permit count cannot repair the lifetime mismatch. The current code returns every permit before its corresponding request completes.
- d. Synchronization serializes only the brief call to `fetch`; once each call returns its future, the next caller can submit another request while earlier requests remain in flight.
