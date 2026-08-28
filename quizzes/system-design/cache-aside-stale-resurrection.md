---
id: system-design-cache-aside-stale-resurrection
status: draft
---

## Question

A profile service uses cache-aside reads. Writers commit the database update, then delete the Redis key. Which change closes the race where an old value can reappear after successful invalidation?

```text
Reader: GET miss -> SELECT version 7 -----------------> SETEX version 7
Writer:                 UPDATE version 8 -> COMMIT -> DEL key
```

## Answers

a. Extend the TTL and retry cache deletion after every database update.
b. Serialize cache misses with a lock shared only by the reader instances.
c. Keep a version tombstone and reject cache writes older than the recorded version.
d. Delete the cache entry before the database transaction commits its update.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

A reader can load version 7, then write it after version 8 commits and deletes the key. A version tombstone plus compare-and-set rejects the stale cache write.

</details>
