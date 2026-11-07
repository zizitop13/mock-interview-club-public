# Phaser registration leaks that stall batch completion

## Correct answer

c. Early return or failure leaks a party; deregister every registered task in `finally`.

## Detailed explanation

A `Phaser` advances only after every party registered for the current phase has arrived. This code registers each job before submission, so every task owns one party even if validation later rejects the job.

The early return bypasses `arriveAndDeregister()`. An exception from `process` does the same. The task can finish and its virtual thread can disappear, but the Phaser still counts its party. The coordinator's `arriveAndAwaitAdvance()` therefore waits indefinitely.

Registration and deregistration form a lifecycle. Once submission has successfully registered a task, the task must release that party in `finally`. The coordinator keeps its own initial party until all tasks have been submitted, then arrives and deregisters itself.

If submission itself can fail, the submitting thread must also undo the registration for the task that was never started. A production batch should additionally define cancellation and timeout behavior rather than assuming all work eventually completes.

## Code example

```java
Phaser phaser = new Phaser(1);

for (Job job : jobs) {
    phaser.register();
    try {
        executor.submit(() -> {
            try {
                if (job.valid()) {
                    process(job);
                }
            } finally {
                phaser.arriveAndDeregister();
            }
        });
    } catch (RuntimeException submissionFailure) {
        phaser.arriveAndDeregister();
        throw submissionFailure;
    }
}

phaser.arriveAndAwaitAdvance();
```

Now every successful registration has a matching deregistration, whether processing succeeds, validation returns early, or processing throws.

## Why the other options are incorrect

- a. Each task is a distinct Phaser party; virtual-thread scheduling does not merge registrations. Registering only after validation would also move validation outside the submitted task.
- b. A Phaser does not observe executor lifecycle. Closing the executor neither arrives nor deregisters parties that tasks leaked.
- d. `bulkRegister(1)` has the same effect as `register()` here, so the unmatched party remains and the phase still cannot advance.
