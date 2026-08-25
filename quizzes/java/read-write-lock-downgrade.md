---
id: java-read-write-lock-downgrade
status: draft
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

Downgrade safely by acquiring the read lock while still holding the write lock, then release the write lock. The read lock keeps other writers out while the cached value is read.

Option a is incorrect because acquiring a read lock after releasing a write lock does not inherently deadlock.

Option b is incorrect because the write lock protects both containsKey() and put().

Option d is incorrect because the return expression is evaluated before the finally block releases the read lock.

</details>
