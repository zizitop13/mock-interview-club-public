package club.mockinterview.kubernetes;

import java.time.Duration;
import java.util.Objects;

public record TerminationBudget(
        Duration podGracePeriod,
        Duration preStopDuration,
        Duration applicationShutdownDuration) {

    public TerminationBudget {
        requireNonNegative(podGracePeriod, "podGracePeriod");
        requireNonNegative(preStopDuration, "preStopDuration");
        requireNonNegative(applicationShutdownDuration, "applicationShutdownDuration");
    }

    public Duration timeRemainingAfterSigterm() {
        Duration remaining = podGracePeriod.minus(preStopDuration);
        return remaining.isNegative() ? Duration.ZERO : remaining;
    }

    public boolean allowsGracefulApplicationShutdown() {
        return timeRemainingAfterSigterm().compareTo(applicationShutdownDuration) >= 0;
    }

    private static void requireNonNegative(Duration value, String name) {
        Objects.requireNonNull(value, name);
        if (value.isNegative()) {
            throw new IllegalArgumentException(name + " must not be negative");
        }
    }
}
