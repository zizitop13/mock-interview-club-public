# Scaling seat reservations with per-show locks

## Correct answer

b. Keep one booking state per show and synchronize only that show's `add`.

## Detailed explanation

The business invariant is that a seat can transition from available to reserved at most once within its show. Reservations for different shows do not share that invariant and should not contend on one application-wide lock.

The original `synchronized` instance method is correct for a single process: it protects both the `HashMap` and every nested `HashSet`. Its lock boundary is unnecessarily broad, however. Every request must acquire the `SeatReservations` monitor, so a reservation for one show delays reservations for every other show. Adding request threads cannot remove this contention hotspot.

The smallest production-reasonable change is to keep one state object per show in a `ConcurrentHashMap` and synchronize the check-and-add inside that state. `computeIfAbsent` performs only short object creation; the per-show monitor then makes `HashSet.add` atomic for callers targeting the same show. Different show objects have different monitors, so their reservations can progress concurrently.

This is an in-process boundary. If multiple service instances can authoritatively reserve the same seat, the same invariant must instead be enforced by shared storage, such as a unique database constraint or an atomic conditional write.

## Code example

```java
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class SeatReservations {
    private final ConcurrentHashMap<String, ShowSeats> shows =
        new ConcurrentHashMap<>();

    public boolean reserve(String showId, String seatId) {
        ShowSeats show = shows.computeIfAbsent(
            showId, ignored -> new ShowSeats());
        return show.reserve(seatId);
    }

    private static final class ShowSeats {
        private final Set<String> reserved = new HashSet<>();

        synchronized boolean reserve(String seatId) {
            return reserved.add(seatId);
        }
    }
}
```

The runnable proof blocks one reservation while it owns the original service-wide monitor and shows that an unrelated show cannot enter. Its fix test shows that another show proceeds through a different state object while the first is blocked, then verifies that concurrent attempts for one seat still produce exactly one success.

## Why the other options are incorrect

- a. A concurrent outer map does not make its mutable `HashSet` values safe; concurrent `add` calls can corrupt state or violate exclusivity.
- c. A fair `ReentrantLock` changes waiter admission but keeps the same service-wide lock boundary and contention hotspot.
- d. A global single-thread executor preserves correctness but deliberately serializes every show, making the scaling problem worse.
