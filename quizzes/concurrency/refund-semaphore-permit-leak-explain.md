# Restoring refund capacity after gateway failures

## Correct answer

a. Put the gateway call in `try` and release the acquired permit from `finally`.

## Detailed explanation

The hidden problem is a semaphore permit leak. The happy path acquires and releases one permit, but an unchecked exception from `gateway.refund` jumps past `gatewaySlots.release()`.

The business invariant is: every call that successfully acquires one gateway slot must return exactly one permit, whether the refund succeeds or fails. That keeps concurrent gateway work bounded at 20 without permanently reducing future capacity. After 20 failing calls in the original code, no permits remain and every later request waits at `acquire()`, even after the gateway recovers.

A `finally` block is the narrow correctness boundary. Place it only after `acquire()` succeeds: an interruption while waiting acquires no permit and therefore must not release one. The gateway call remains outside any JVM-wide monitor, so up to 20 independent refunds can still progress.

## Code example

```java
public Receipt refund(String paymentId, long cents)
        throws InterruptedException {
    gatewaySlots.acquire();
    try {
        return gateway.refund(paymentId, cents);
    } finally {
        gatewaySlots.release();
    }
}
```

## Why the other options are incorrect

- b. Fairness changes which waiter receives the next available permit; it cannot recover permits skipped after exceptions.
- c. More permits only postpone exhaustion. Repeated failures still leak every permit and eventually stop all progress.
- d. Synchronizing the method reduces concurrency to one caller and still skips `release()` when the gateway throws.
