# Floating license server — Build solution

This Stage 1 solution uses one piece of capacity state: a regular `HashMap` guarded by a single `ReentrantLock`. The invariant is:

> `licenseMap.size() <= licenseNumber`

## Approach

Every public operation acquires the same lock before it reads or changes session state. This makes each business transition atomic from the point of view of other callers.

For acquisition, expiry cleanup, the idempotency check, the capacity check, and insertion happen inside one critical section. No other request can change the map between those steps.

```java
@Override
public boolean obtainLicense(String userId) {
    stateLock.lock();
    try {
        Instant now = clock.instant();
        returnExpired(now);

        if (licenseMap.containsKey(userId)) {
            return true;
        }
        if (licenseMap.size() >= licenseNumber) {
            return false;
        }

        licenseMap.put(userId, new LicenseSession(now));
        return true;
    } finally {
        stateLock.unlock();
    }
}
```

The map is the only capacity counter. Removing a session immediately frees one place; inserting a session consumes one place.

## Heartbeat and expiry

Heartbeat uses the same lock because it changes the session timestamp. An already expired session cannot be revived by a late heartbeat; it is removed and the caller must obtain a new session.

```java
@Override
public boolean pingLicense(String userId) {
    stateLock.lock();
    try {
        Instant now = clock.instant();
        LicenseSession session = licenseMap.get(userId);

        if (session == null) {
            return false;
        }
        if (session.expired(now, expireAfter)) {
            licenseMap.remove(userId);
            return false;
        }

        session.ping(now);
        return true;
    } finally {
        stateLock.unlock();
    }
}
```

Expiry cleanup is called only while the same lock is held. It therefore has a clear order relative to heartbeat, release, and allocation.

## Release

Release is a map removal inside the same critical section. A second release finds no session and returns `false`, so capacity cannot be freed twice.

```java
@Override
public boolean releaseLicense(String userId) {
    stateLock.lock();
    try {
        return licenseMap.remove(userId) != null;
    } finally {
        stateLock.unlock();
    }
}
```

## Concurrency review

The design preserves these properties:

- Capacity checking and insertion are one atomic operation.
- Duplicate acquisition by one user does not consume capacity twice.
- Expiry, heartbeat, release, and allocation cannot interleave halfway through a state transition.
- The mutable session timestamp is always accessed while the same lock is held.
- `licenseMap.size()` remains the only source of capacity truth.

The trade-off is deliberate: every request serializes on one lock. For a small, single-process coding exercise, this is a simple correctness-first design. If profiling later shows contention, the state model can be redesigned rather than adding another synchronization mechanism beside the map.

## Complete Maven project

The repository contains the full standalone project with its `pom.xml`, production sources, and tests:

[Open `lab-projects/coding/floating-license-server`](https://github.com/zizitop13/mock-interview-club-public/tree/main/lab-projects/coding/floating-license-server)

Run it with:

```bash
mvn test
```
