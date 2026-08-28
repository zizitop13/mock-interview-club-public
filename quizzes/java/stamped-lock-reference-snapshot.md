---
id: java-stamped-lock-reference-snapshot
status: published
---

## Question

Updates hold the write lock, and single-threaded tests pass. Why can `currentRange()` return a pair of values that never formed a valid range?

```java
final class LimitsService {
    private final StampedLock lock = new StampedLock();
    private final Limits limits = new Limits();

    void update(int low, int high) {
        long stamp = lock.writeLock();
        try {
            limits.low = low;
            limits.high = high;
        } finally {
            lock.unlockWrite(stamp);
        }
    }

    Range currentRange() {
        long stamp = lock.tryOptimisticRead();
        Limits current = limits;

        if (!lock.validate(stamp)) {
            stamp = lock.readLock();
            try {
                current = limits;
            } finally {
                lock.unlockRead(stamp);
            }
        }

        return new Range(current.low, current.high);
    }

    static final class Limits {
        int low;
        int high;
    }
}
```

## Answers

a. The optimistic stamp protects `limits` until the `Range` constructor has completed.
b. Validation covers the reference read, but the fields are copied after protection has ended.
c. Calling `validate` consumes the stamp, so later reads may observe default field values.
d. Releasing the read lock can publish an older `Limits` object back to the writer.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

The method validates or locks only while copying a mutable reference. A writer can change its fields before they are copied, producing a mixed snapshot.

</details>
