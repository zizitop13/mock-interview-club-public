# A Condition signal sent before await is lost

## Correct answer

a. Conditions retain no signal; guard a state predicate under the lock and await in a loop.

## Detailed explanation

A `Condition` wait set contains threads, not durable events. `signal` or `signalAll` transfers threads that are already waiting so they can compete to reacquire the associated lock. If no thread is waiting, the notification has no later effect.

In the example, `onConnected` may finish before `awaitConnected` calls `await`. The later call then releases the lock and sleeps even though the connection event already happened. There may be no second callback to wake it.

The condition notification must accompany a state transition protected by the same lock. The waiter checks that predicate before sleeping and checks it again after every wakeup. The loop is required because condition waits may return spuriously, and because another thread may change the state before the awakened waiter reacquires the lock.

For a one-shot lifecycle event, `CountDownLatch` is another practical choice because a zero count is remembered. For reusable connected/disconnected transitions, an explicit predicate plus `Condition` expresses the state correctly.

## Code example

```java
final class ConnectionGate {
    private final Lock lock = new ReentrantLock();
    private final Condition stateChanged = lock.newCondition();
    private boolean connected;

    void onConnected() {
        lock.lock();
        try {
            connected = true;
            stateChanged.signalAll();
        } finally {
            lock.unlock();
        }
    }

    void awaitConnected() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (!connected) {
                stateChanged.await();
            }
        } finally {
            lock.unlock();
        }
    }

    void onDisconnected() {
        lock.lock();
        try {
            connected = false;
        } finally {
            lock.unlock();
        }
    }
}
```

The predicate is the truth; the signal is only an optimization that tells waiters when to recheck it.

## Why the other options are incorrect

- b. `signalAll` wakes all threads currently in this condition's wait set. Neither `signal` nor `signalAll` reserves notifications for future waiters.
- c. `await` releases the lock only while waiting and reacquires it before returning. A static monitor would not make an early notification durable.
- d. Lock acquisition already provides the needed visibility for state protected by that lock. Making the `Condition` reference volatile would not record a signal.
