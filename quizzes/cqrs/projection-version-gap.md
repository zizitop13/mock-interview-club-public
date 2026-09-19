---
id: cqrs-projection-version-gap
status: draft
---

## Question

An order emits immutable versions 10–12. Delivery is at least once and may reorder; deferred events can be retried. The projector has `last_version=10`, and every event is a delta, so applying v12 before v11 loses data. Which rule makes the read model converge without skipping a gap?

```text
stored projection: last_version = 10
delivery order:    v12, v11, v12, v11
```

## Answers

a. Apply any version above `last_version`; store the event's version after applying it.
b. Buffer by event timestamp for a fixed interval; then discard every older arrival.
c. Atomically apply only `last_version + 1`; ignore old duplicates and retry gaps.
d. Apply in arrival order; let a nightly rebuild replace the projection if it differs.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

Per-aggregate sequence checks prevent duplicates and gaps. v12 is deferred at v10; after v11 commits, retrying v12 advances the projection safely.

</details>
