---
id: concurrency-seat-reservation-lock-granularity
status: published
---

## Question

A single JVM ticket service reserves seats for many independent shows. Which change best preserves single-seat exclusivity while allowing independent shows to progress concurrently?

```java
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public final class SeatReservations {
    private final Map<String, Set<String>> reservedByShow =
        new HashMap<>();

    public synchronized boolean reserve(String showId, String seatId) {
        return reservedByShow
            .computeIfAbsent(showId, ignored -> new HashSet<>())
            .add(seatId);
    }
}
```

## Answers

a. Use `ConcurrentHashMap<String, HashSet<String>>` and remove synchronization.
b. Keep one booking state per show and synchronize only that show's `add`.
c. Replace the method monitor with one fair `ReentrantLock` around the same body.
d. Send every reservation through one single-thread executor before changing the map.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

The method monitor protects correctness but serializes unrelated shows. A per-show lock keeps each seat's check-and-add atomic while different shows proceed concurrently.

</details>
