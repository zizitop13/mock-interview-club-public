# Preventing stale cache resurrection after invalidation

## Correct answer

c. Keep a version tombstone and reject cache writes older than the recorded version.

## Detailed explanation

Cache-aside invalidation after the database commit avoids one common failure: readers do not observe an invalidation before an update that later rolls back. It does not, however, make a cache miss and refill atomic with a concurrent write.

The reader can miss Redis and read profile version 7 from the database. Before it refills Redis, the writer commits version 8 and successfully deletes the key. The delayed reader then writes version 7 into the now-empty cache. Every following request can receive the old profile until the TTL expires, even though the invalidation itself succeeded.

```plantuml
@startuml
participant Reader
database PostgreSQL as DB
participant Writer
database Redis as Cache

Reader -> Cache: GET profile:42
Cache --> Reader: miss
Reader -> DB: SELECT profile, version=7
DB --> Reader: version 7
Writer -> DB: UPDATE profile, version=8; COMMIT
Writer -> Cache: DEL profile:42
Cache --> Writer: deleted
Reader -> Cache: SETEX profile:42, version=7
note over Cache: stale value resurrected\nafter invalidation

== Correct solution: version tombstone and CAS ==

Reader -> Cache: GET profile:42
Cache --> Reader: miss
Reader -> DB: SELECT profile, version=7
DB --> Reader: version 7
Writer -> DB: UPDATE profile, version=8; COMMIT
Writer -> Cache: atomic DEL payload\n+SET latest-version=8
Reader -> Cache: CAS payload version=7\nagainst latest-version=8
Cache --> Reader: rejected as stale
Reader -> DB: reload current version
DB --> Reader: version 8
Reader -> Cache: CAS payload version=8
Cache --> Reader: stored
@enduml
```

A robust versioned design keeps the newest known version independently of the cached payload. The writer advances that version, or installs a short-lived tombstone containing version 8, after the database commit. A refill uses an atomic compare-and-set operation: it may store version 7 only if the recorded version is not newer. Redis Lua, a transaction, or a purpose-built conditional command can make the comparison and write one atomic operation.

The tombstone must live long enough to cover the maximum realistic in-flight read and retry delay. Versioning also requires a monotonic source, such as a database row version or commit sequence. This adds state and operational complexity, so many systems instead accept bounded staleness, use short TTLs, update the cache synchronously, or route reads and writes for one key through the same owner. The right choice follows the business cost of stale reads.

## Code example

```lua
-- KEYS[1] = payload key, KEYS[2] = latest-version key
-- ARGV[1] = candidate version, ARGV[2] = TTL seconds, ARGV[3] = payload
local latest = redis.call('GET', KEYS[2])
if latest and tonumber(latest) > tonumber(ARGV[1]) then
  return 0
end

redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[2])
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
return 1
```

The writer records version 8 in the version key after committing. When the delayed reader attempts to install version 7, the script returns `0` without changing the payload. In production, the payload and version-key expiry policy must ensure that removing the guard cannot reopen the race for an older in-flight request.

## Why the other options are incorrect

- a. A longer TTL makes a resurrected stale value survive longer. Retrying deletion can reduce the window probabilistically, but a delayed reader can still refill after the final retry.
- b. A reader-only single-flight lock coalesces concurrent misses, but writers do not participate in its ordering. One locked reader can still refill stale data after the writer deletes the key.
- d. Deleting before commit creates additional races: readers can reload the old database value before commit, and a rolled-back transaction leaves the cache invalidated without publishing any new state.
