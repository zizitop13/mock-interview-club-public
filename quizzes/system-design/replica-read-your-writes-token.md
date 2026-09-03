---
id: system-design-replica-read-your-writes-token
status: published
---

## Question

A profile update commits on the primary, but the client's immediate GET sometimes returns the old profile from a read replica. Which design preserves read-your-writes while keeping replica reads?

```text
POST /profile -> primary commits version 42 -> 200 OK
GET  /profile -> replica still at version 41 -> stale response
```

## Answers

a. Delay every GET for a fixed interval before sending it to a randomly selected replica.
b. Pin the client to one API instance so its later requests reuse the same database connection.
c. Return a commit token and use a replica only after it reaches that position, otherwise use primary.
d. Run each GET at repeatable read so the replica reconstructs the primary's committed snapshot.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

Async replicas can lag after a successful write. A commit-position token lets later reads verify replica progress and fall back to the primary until the required write is visible.

</details>
