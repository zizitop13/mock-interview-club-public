---
id: system-design-idempotency-key-committed-response-loss
status: draft
---

## Question

A payment API times out after its database commit, so the client retries the same idempotency key on another instance. Which design safely prevents a second charge and returns a stable response?

```sql
CREATE TABLE idempotency_keys (
    merchant_id bigint NOT NULL,
    idempotency_key text NOT NULL,
    request_hash text NOT NULL,
    status text NOT NULL,
    response_json jsonb,
    PRIMARY KEY (merchant_id, idempotency_key)
);
```

## Answers

a. Cache the key before charging; on a retry, return success while the cached key exists.
b. Query for a similar recent payment; reuse it when amount and customer both match.
c. Insert the key first; if charging later fails, delete the key so retries may continue.
d. Atomically store the key, request hash, charge, and response; replay it only for the same hash.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

The idempotency record, business change, and replayable response must commit atomically. The request hash also prevents accidental key reuse with different input.

</details>
