# Floating license server — Build solution

This Stage 1 solution uses one piece of capacity state: a regular `HashMap` guarded by a `ReentrantReadWriteLock`. The invariant is:

> `licenseMap.size() <= licenseNumber`

There is no semaphore whose permits can drift away from the map.

## Approach

An idempotent request for an existing, active session is read-only, so multiple such requests may proceed under the shared read lock.

Creating a session is different. It may remove expired entries, inspect the map size, and insert a new entry. Those steps form one decision and run together under the write lock.

```java
@Override
public boolean obtainLicense(String userId) {
    Instant now = clock.instant();

    readLock.lock();
    try {
        LicenseSession existing = licenseMap.get(userId);
        if (existing != null && !existing.expired(now, expireAfter)) {
            return true;
        }
    } finally {
        readLock.unlock();
    }

    writeLock.lock();
    try {
        now = clock.instant();
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
        writeLock.unlock();
    }
}
```

The method releases the read lock before taking the write lock because `ReentrantReadWriteLock` does not support safe lock upgrading. It then checks the state again: another thread may have inserted, renewed, released, or expired a session between the two lock acquisitions.

## Heartbeat and expiry

Heartbeat changes a session, so it uses the write lock. An already expired session cannot be revived by a late heartbeat; it is removed and the caller must obtain a new session.

```java
@Override
public boolean pingLicense(String userId) {
    writeLock.lock();
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
        writeLock.unlock();
    }
}
```

Expiry cleanup is called only while the write lock is held. Therefore, it cannot race with heartbeat, release, or another allocation.

## Release

Release is a single map removal under the write lock. The map size immediately becomes the available capacity; no permit needs to be returned.

```java
@Override
public boolean releaseLicense(String userId) {
    writeLock.lock();
    try {
        return licenseMap.remove(userId) != null;
    } finally {
        writeLock.unlock();
    }
}
```

## Concurrency review

This version fixes the races in the semaphore implementation:

- Capacity checking and insertion are one write-locked operation.
- Duplicate requests cannot consume capacity twice.
- Expiry and release cannot free the same capacity twice.
- Heartbeat cannot race with removal or update a detached session.
- An expired session is not returned as active and cannot be revived by a late heartbeat.
- Every access to the ordinary `HashMap` and mutable `LicenseSession` is protected by the same lock.

The main trade-off is that heartbeat, release, cleanup, and new allocation serialize on one write lock. The default non-fair `ReentrantReadWriteLock` can also delay a writer during a sustained stream of readers. For this small, single-process exercise that is a reasonable correctness-first design; for a write-heavy workload, a simple `ReentrantLock` would likely be clearer and just as fast.

## Complete Maven project

The repository contains the full standalone project with its `pom.xml`, production sources, and tests:

[Open `lab-projects/coding/floating-license-server`](https://github.com/zizitop13/mock-interview-club-public/tree/main/lab-projects/coding/floating-license-server)

Run it with:

```bash
mvn test
```
