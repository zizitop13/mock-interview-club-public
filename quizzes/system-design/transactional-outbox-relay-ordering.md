---
id: system-design-transactional-outbox-relay-ordering
status: draft
---

## Question

Two relay instances claim outbox rows with `SKIP LOCKED`, publish to Kafka keyed by `order_id`, then mark them sent. Rows have per-order sequence numbers. Which design handles crashes without silently losing events and detects per-order reordering?

```sql
SELECT id, order_id, sequence_no, payload
FROM outbox
WHERE published_at IS NULL
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT 100;

-- publish batch to Kafka, then:
UPDATE outbox SET published_at = now() WHERE id = ANY(:ids);
```

## Answers

a. Publish first; consumers dedupe by event_id and enforce sequence, buffering or retrying gaps.
b. Enable Kafka idempotence; it deduplicates across relays and preserves each order's full history.
c. Mark rows sent before publishing; retries disappear and Kafka keys preserve each order's history.
d. Use a random key and one consumer group; committed offsets impose a global event order.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

Publishing before marking avoids silent loss but permits duplicates after a crash. Multiple relays can also publish one order's rows out of sequence, so consumers need event deduplication and sequence checks.

</details>
