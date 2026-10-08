---
id: concurrency-fraud-cache-immutable-snapshot
status: draft
---

## Question

A fraud service refreshes card risk scores while request threads evaluate payments. Which smallest change gives each evaluation one complete refresh without locking reads?

```java
import java.util.HashMap;
import java.util.Map;

public final class FraudDecisionCache {
    private static final int BLOCK_SCORE = 80;

    // One refresh thread; many request threads.
    private volatile Map<String, Integer> scores = new HashMap<>();

    public void refresh(Map<String, Integer> nextScores) {
        scores.clear();
        scores.putAll(nextScores);
    }

    public boolean shouldBlock(String cardId) {
        return scores.getOrDefault(cardId, 0) >= BLOCK_SCORE;
    }
}
```

## Answers

a. Replace `HashMap` with `ConcurrentHashMap` but keep `clear()` and `putAll()`.
b. Synchronize only `refresh()` so no two refresh operations overlap.
c. Guard both methods with a `ReadWriteLock`, locking every evaluation read.
d. Assign `Map.copyOf(nextScores)` to the volatile reference on each refresh.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

`volatile` does not make in-place map mutation atomic. Build an immutable copy, then publish it with one volatile assignment so readers see one complete snapshot.

</details>
