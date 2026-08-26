---
id: java-volatile-counters-false-sharing
status: published
---

## Question

Each field has a single writer, and the final values are correct. Why can throughput still collapse when both workers run on different CPU cores?

```java
final class Metrics {
    volatile long requests;
    volatile long errors;
}

Metrics metrics = new Metrics();

Thread requestWorker = new Thread(() -> {
    for (long i = 0; i < 500_000_000L; i++) {
        metrics.requests++;
    }
});

Thread errorWorker = new Thread(() -> {
    for (long i = 0; i < 500_000_000L; i++) {
        metrics.errors++;
    }
});

requestWorker.start();
errorWorker.start();
requestWorker.join();
errorWorker.join();
```

## Answers

a. The fields may share a cache line, so each write invalidates the other core's cached copy.
b. The JVM uses one global monitor for writes to every volatile field in the process.
c. Volatile long writes can tear, causing both workers to repeat increments until they succeed.
d. Calling join() flushes both counters on every iteration and synchronizes the worker threads.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

The independent fields may occupy one cache line, causing false sharing: writes make the line bounce between cores even though the threads never share a logical counter.

</details>
