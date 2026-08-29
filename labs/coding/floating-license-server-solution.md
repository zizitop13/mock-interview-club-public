# Floating license server — Build solution

This is the Stage 1 solution copied from the `interviews-prep` project. It is one possible in-memory implementation for a single Java process.

## Approach

The implementation combines two pieces of state:

- A `ConcurrentHashMap` stores one session per user.
- A counting `Semaphore` represents the number of licenses that may be active at the same time.

`obtainLicense` first handles the idempotent case for an existing user. For a new user, it tries to acquire a semaphore permit. If capacity is exhausted, it checks for expired sessions, returns their permits, and tries once more.

```java
@Override
public boolean obtainLicense(String userId) {
    if (licenseMap.containsKey(userId)) {
        return true;
    }

    Instant now = clock.instant();

    if (!sessionsLimiter.tryAcquire()) {
        returnExpired(now);
        if (!sessionsLimiter.tryAcquire()) {
            return false;
        }
    }

    return licenseMap.putIfAbsent(userId, new LicenseSession(now)) == null;
}
```

## Heartbeat and expiry

Each `LicenseSession` stores the last heartbeat time. A supplied `Clock` makes expiry behavior testable without waiting in real time.

```java
public boolean expired(Instant now, TemporalAmount timeout) {
    return !now.isBefore(pinged.plus(timeout));
}

public void ping(Instant time) {
    this.pinged = time;
}
```

## Release

Removing a session and returning its permit makes repeated release return `false` without adding capacity twice.

```java
@Override
public boolean releaseLicense(String userId) {
    if (licenseMap.remove(userId) != null) {
        sessionsLimiter.release();
        return true;
    }
    return false;
}
```

## Review questions

Before treating this as production-ready, review the boundaries between the map and semaphore carefully:

- Are acquiring a permit and inserting the user one atomic decision?
- What happens when two concurrent requests obtain a license for the same new user?
- Can heartbeat race with release or expiry removal?
- Does every failed insertion return a permit?

These questions are useful follow-ups because thread-safe components do not automatically make a multi-step operation atomic.

## Complete Maven project

The repository contains the full standalone project with its `pom.xml`, production sources, and tests:

[Open `lab-projects/coding/floating-license-server`](https://github.com/zizitop13/mock-interview-club-public/tree/main/lab-projects/coding/floating-license-server)

Run it with:

```bash
mvn test
```
