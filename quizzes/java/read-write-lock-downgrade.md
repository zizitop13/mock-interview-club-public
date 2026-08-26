---
id: java-read-write-lock-downgrade
status: published
---

## Question

What is wrong with this code?

```java
String getOrLoad(String key) {
    lock.writeLock().lock();
    try {
        if (!cache.containsKey(key)) {
            cache.put(key, load(key));
        }
    } finally {
        lock.writeLock().unlock();
    }

    lock.readLock().lock();
    try {
        return cache.get(key);
    } finally {
        lock.readLock().unlock();
    }
}
```

## Answers

a. Acquiring a read lock after a write lock causes a deadlock.
b. Calling containsKey() while holding a write lock is unsafe.
c. Another writer can modify the cache between lock operations.
d. Releasing the read lock before returning causes data corruption.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

Another writer can modify or remove the entry after the write lock is released but before the read lock is acquired.

</details>
