---
id: java-thread-pool-queue-selection
status: published
---

## Question

Why do these thread pools use different queue implementations?

```java
private final ExecutorService backgroundPool =
    new ThreadPoolExecutor(
        4, 4,
        0, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>()
    );

public void enqueueBackgroundTask(Runnable task) {
    backgroundPool.execute(task);
}
```

```java
private final ExecutorService requestPool =
    new ThreadPoolExecutor(
        4, 16,
        30, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(100),
        new ThreadPoolExecutor.AbortPolicy()
    );

public boolean trySubmitRequest(Runnable task) {
    try {
        requestPool.execute(task);
        return true;
    } catch (RejectedExecutionException e) {
        return false;
    }
}
```

## Answers

a. The linked queue preserves task priority, while the array queue preserves submission order.
b. The array queue lets the pool grow, while the linked queue creates one thread per task.
c. The linked queue absorbs bursts, while the array queue limits backlog and memory use.
d. The linked queue blocks when empty, while the array queue immediately returns null.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

The unbounded linked queue absorbs background bursts, while the bounded array queue limits pending requests and provides predictable memory use.

LinkedBlockingQueue is unbounded by default, allowing background tasks to accumulate during traffic spikes. Sustained overload can eventually exhaust memory.

ArrayBlockingQueue has a fixed capacity of 100 tasks. Once full, the executor can grow from 4 to 16 threads. If all threads are busy and the queue remains full, new tasks are rejected, providing backpressure and predictable memory use.

</details>
