---
id: observability-mdc-executor-context
status: draft
---

## Question

An HTTP filter places `traceId` in an MDC backed by `ThreadLocal`. A controller submits work to a reused fixed thread pool, then clears the request thread's MDC. Async logs sometimes miss the ID or show an earlier request's ID. Which executor policy fixes both failures?

```text
pool workers already exist and are reused
the logging backend keeps MDC per thread and does not propagate it
tasks may throw, and a worker may already have context before a task starts
```

## Answers

a. Capture at submission, install on the worker, then restore its prior context in `finally`.
b. Use `InheritableThreadLocal`; pooled workers will inherit every later request value.
c. Mark the context holder `volatile`; each task will then read its submitter's value.
d. Set context after `execute`; memory visibility will select the correct request value.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

Thread-local state belongs to one thread. Capture it at submission, install it for the task, and restore the worker's prior state in `finally`.

</details>
