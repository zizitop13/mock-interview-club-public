# Publishing each fraud-cache refresh as one immutable snapshot

## Correct answer

d. Assign `Map.copyOf(nextScores)` to the volatile reference on each refresh.

## Detailed explanation

The business invariant is that every payment evaluation must use either the complete previous risk-score refresh or the complete next refresh. It must never make a decision from the empty or partially rebuilt map between `clear()` and `putAll()`.

Declaring the map reference `volatile` does not make mutations of the referenced `HashMap` atomic or thread-safe. The original method never replaces the reference, so `clear()` and `putAll()` remain separate mutations of shared state. A request can run between them and treat a card as safe even when both the old and new score sets require it to be blocked.

The smallest lock-free-read fix is immutable snapshot replacement. First construct the complete snapshot away from shared state with `Map.copyOf(nextScores)`. Then assign that map to the volatile field once. The volatile write safely publishes every entry, and each reader's single volatile read yields either the old map or the new map—never an intermediate rebuild.

This design fits a cache with one serialized refresh source and many request readers. It keeps the hot evaluation path free of locks, while paying allocation and copying cost only during refresh.

## Code example

```java
import java.util.Map;

public final class FraudDecisionCache {
    private static final int BLOCK_SCORE = 80;
    private volatile Map<String, Integer> scores = Map.of();

    public void refresh(Map<String, Integer> nextScores) {
        scores = Map.copyOf(nextScores);
    }

    public boolean shouldBlock(String cardId) {
        return scores.getOrDefault(cardId, 0) >= BLOCK_SCORE;
    }
}
```

The input contains non-null card IDs and scores and is not concurrently modified while the copy is built. If a decision needed several lookups from one refresh, it should first copy `scores` into a local variable and use that same snapshot for all lookups.

## Why the other options are incorrect

- a. `ConcurrentHashMap` makes individual operations thread-safe, but `clear()` followed by `putAll()` is still not one atomic refresh; readers can observe an empty or partially repopulated map.
- b. Synchronizing only the single writer does not coordinate unsynchronized readers, so they can still evaluate while the map is between the two mutations.
- c. A correctly used `ReadWriteLock` could protect the invariant, but it locks every evaluation read and is therefore excessive for the stated lock-free-read requirement.
