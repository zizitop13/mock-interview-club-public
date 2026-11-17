---
id: java-condition-early-signal
status: published
---

## Question

A connection callback can arrive before the startup thread begins waiting. Most runs succeed, but fast reconnects hang forever. What is wrong with this use of `Condition`, and what is the robust fix?

```java
private final Lock lock = new ReentrantLock();
private final Condition connected = lock.newCondition();

void onConnected() {
    lock.lock();
    try {
        connected.signalAll();
    } finally {
        lock.unlock();
    }
}

void awaitConnected() throws InterruptedException {
    lock.lock();
    try {
        connected.await();
    } finally {
        lock.unlock();
    }
}
```

## Answers

a. Conditions retain no signal; guard a state predicate under the lock and await in a loop.
b. `signalAll` wakes one waiter; call `signal` once for every future waiting thread.
c. `await` releases the lock forever; replace the lock with a synchronized static method.
d. The lock hides writes from late threads; declare the `Condition` field volatile.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

A `Condition` does not store notifications. Record connection state under the lock, signal after changing it, and wait in `while (!connected)` to handle early signals and spurious wakeups.

</details>
