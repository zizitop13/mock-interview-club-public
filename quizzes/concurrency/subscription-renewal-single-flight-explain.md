# Sharing one in-flight subscription renewal by business key

## Correct answer

c. Install a per-ID `CompletableFuture` with `putIfAbsent`; only its winner charges.

## Detailed explanation

The business invariant is that one renewal ID, whose amount is fixed, produces at most one successful gateway charge in this running JVM, and every concurrent or later call for that ID receives the same receipt. Different renewal IDs must still be able to progress independently.

`ConcurrentHashMap` makes each individual `get` and `put` thread-safe, but it does not make the sequence `get` → gateway charge → `put` atomic. Two callers can both observe no completed receipt, both perform the external side effect, and only then race to cache their different receipts. Calling `putIfAbsent` after charging chooses which receipt is retained, but it cannot undo the extra charge.

The practical in-process boundary is a per-ID completion placeholder installed before the side effect. Each caller creates a `CompletableFuture`, and `putIfAbsent` atomically elects the winner for that renewal ID. Only the winner invokes the gateway and completes the future. Followers wait on the already-installed future, and successful later retries replay the same completed result. Calls for other IDs use different map entries and do not share a global monitor.

Because the stated gateway fails only before charging, the winner may complete the future exceptionally and conditionally remove its own entry so a later call can retry safely. If the gateway could charge and then lose its response, the process could crash, or several service replicas shared the renewal ID, this in-memory boundary would be insufficient; durable provider or database idempotency would then be required.

## Code example

```java
private final ConcurrentHashMap<String, CompletableFuture<Receipt>> renewals =
    new ConcurrentHashMap<>();

public Receipt renew(String renewalId, long cents) {
    CompletableFuture<Receipt> mine = new CompletableFuture<>();
    CompletableFuture<Receipt> existing = renewals.putIfAbsent(renewalId, mine);
    if (existing != null) return existing.join();

    try {
        Receipt receipt = gateway.charge(renewalId, cents);
        mine.complete(receipt);
        return receipt;
    } catch (RuntimeException failureBeforeCharge) {
        mine.completeExceptionally(failureBeforeCharge);
        renewals.remove(renewalId, mine);
        throw failureBeforeCharge;
    }
}
```

The conditional `remove(key, value)` prevents an older failing caller from deleting a newer placeholder if the failure and retry paths ever overlap.

## Why the other options are incorrect

- a. Installing a winner after the gateway call can stabilize the cached response, but concurrent callers may already have performed multiple charges.
- b. Synchronizing the entire method would prevent duplicates in one service instance, but it unnecessarily serializes independent renewal IDs and violates the stated concurrency requirement.
- d. Protecting only the lookup leaves the gateway call outside the critical section, so multiple callers can still observe absence and charge concurrently.
