---
id: java-phaser-party-leak
status: draft
---

## Question

A virtual-thread batch sometimes never reports completion although every submitted task has returned. What is wrong?

```java
Phaser phaser = new Phaser(1);

for (Job job : jobs) {
    phaser.register();
    executor.submit(() -> {
        if (!job.valid()) return;
        process(job);
        phaser.arriveAndDeregister();
    });
}

phaser.arriveAndAwaitAdvance();
```

## Answers

a. Virtual threads share one Phaser party, so register each task only after validation.
b. The await call waits for executor shutdown, so close the executor before awaiting.
c. Early return or failure leaks a party; deregister every registered task in `finally`.
d. Phaser needs a fixed party count, so replace each `register()` with `bulkRegister(1)`.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

Every registration needs one arrival or deregistration. An early return or exception skips it, so the coordinator waits for a party that will never arrive.

</details>
