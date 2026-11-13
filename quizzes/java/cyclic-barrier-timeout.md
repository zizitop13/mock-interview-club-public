---
id: java-cyclic-barrier-timeout
status: draft
---

## Question

Three feed tasks share one `CyclicBarrier` across pricing rounds. One feed misses the deadline; fallback runs, but later rounds immediately fail with `BrokenBarrierException`. Why does the coordinator stay unusable, and what is the practical fix?

```java
final CyclicBarrier barrier = new CyclicBarrier(3);

void onQuote(Quote quote) throws Exception {
    try {
        barrier.await(100, TimeUnit.MILLISECONDS);
        aggregate(quote);
    } catch (TimeoutException timeout) {
        fallback(quote);
    }
}
```

## Answers

a. Each timeout consumes one arrival, so three failed rounds permanently exhaust the barrier.
b. A timeout breaks the barrier; current and later waiters fail until it is safely replaced.
c. Only the timed waiter fails; the other parties keep waiting for the same generation.
d. The timeout runs the barrier action early, so aggregation uses a partial quote set.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

A timed-out waiter breaks that barrier generation. Other waiters and later callers fail until the failed round is abandoned and a fresh barrier is used.

</details>
