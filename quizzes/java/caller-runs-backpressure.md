---
id: java-caller-runs-backpressure
status: published
---

## Question

A Kafka poll loop delegates blocking enrichment to a bounded executor. Under load, polling pauses for seconds even though the consumer code never waits on a `Future`. What causes the pause, and which backpressure strategy is safer?

```java
ExecutorService enrichmentPool = new ThreadPoolExecutor(
    8, 8, 0, TimeUnit.MILLISECONDS,
    new ArrayBlockingQueue<>(100),
    new ThreadPoolExecutor.CallerRunsPolicy()
);

void onRecord(ConsumerRecord<String, Order> record) {
    enrichmentPool.execute(() -> enrichAndStore(record.value()));
}
```

## Answers

a. The queue blocks `execute` until space opens; enlarge it to prevent poll-loop pauses.
b. The pool steals the consumer thread at max size; allow core threads to time out.
c. The consumer runs rejected work inline; reject explicitly and pause or reduce intake.
d. The policy drops overflow after logging; retry rejected records from the poll loop.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

`CallerRunsPolicy` executes overflow work on the submitting thread. For a poll loop, reject explicitly and apply controlled intake backpressure instead of running blocking work inline.

</details>
