---
id: java-concurrent-hash-map-slow-compute
status: draft
---

## Question

This cache returns correct values, but latency spikes for different tenants whose keys collide. What is the concurrency problem?

```java
final class TokenCache {
    private final ConcurrentHashMap<TenantKey, Token> tokens =
        new ConcurrentHashMap<>();
    private final AuthClient authClient;

    Token tokenFor(TenantKey key) {
        return tokens.computeIfAbsent(
            key,
            ignored -> authClient.fetchToken(key)
        );
    }
}
```

## Answers

a. The mapping function may run concurrently many times for the same absent key.
b. Every cache hit acquires one global map lock until the returned token is consumed.
c. A token created in the mapping function is not safely published to later readers.
d. A slow mapping function can block updates for other keys that occupy the same bin.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

computeIfAbsent is atomic per key, but its mapping must stay short. Slow I/O can hold bin-level coordination and delay updates for unrelated keys whose hashes reach the same bin.

</details>
