---
id: rest-if-match-lost-update
status: draft
---

## Question

Clients A and B both GET a profile with strong ETag `"v7"`. A updates it and the server advances the ETag to `"v8"`. B then submits an update derived from the old representation. The requirement is to reject B before applying it. Which HTTP contract satisfies this?

```http
GET /profiles/42
ETag: "v7"

PUT /profiles/42  # client A
If-Match: "v7"

HTTP/1.1 200 OK
ETag: "v8"
```

## Answers

a. Require `If-None-Match: "v7"`; return `304 Not Modified` when the tag still matches.
b. Require one idempotency key per profile; replay A's response when B sends the same key.
c. Require `If-Match: "v7"`; return `412 Precondition Failed` after A advances the tag.
d. Return ETags on GET only; serialize PUT requests in the application without a precondition.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

`If-Match` makes the write conditional on the current strong ETag. Once A changes it to `"v8"`, B's `"v7"` precondition fails, so the server returns 412 without applying B's update.

</details>
