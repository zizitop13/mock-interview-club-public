package club.mockinterview.concurrency;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;

public final class SeatReservations {
    private final Map<String, Set<String>> globallyReservedByShow = new HashMap<>();
    private final ConcurrentHashMap<String, ShowSeats> partitionedShows =
            new ConcurrentHashMap<>();
    private final BiConsumer<String, String> afterReservation;

    public SeatReservations() {
        this((showId, seatId) -> { });
    }

    SeatReservations(BiConsumer<String, String> afterReservation) {
        this.afterReservation = Objects.requireNonNull(afterReservation);
    }

    public synchronized boolean reserve(String showId, String seatId) {
        requireIds(showId, seatId);
        boolean reserved = globallyReservedByShow
                .computeIfAbsent(showId, ignored -> new HashSet<>())
                .add(seatId);
        if (reserved) {
            afterReservation.accept(showId, seatId);
        }
        return reserved;
    }

    public boolean reservePerShow(String showId, String seatId) {
        requireIds(showId, seatId);
        ShowSeats show = partitionedShows.computeIfAbsent(
                showId, ignored -> new ShowSeats());
        return show.reserve(
                seatId, () -> afterReservation.accept(showId, seatId));
    }

    private static void requireIds(String showId, String seatId) {
        Objects.requireNonNull(showId);
        Objects.requireNonNull(seatId);
    }

    private static final class ShowSeats {
        private final Set<String> reserved = new HashSet<>();

        synchronized boolean reserve(String seatId, Runnable afterReservation) {
            boolean added = reserved.add(seatId);
            if (added) {
                afterReservation.run();
            }
            return added;
        }
    }
}
