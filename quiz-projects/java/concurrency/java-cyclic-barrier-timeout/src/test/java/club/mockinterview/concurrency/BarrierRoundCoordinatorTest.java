package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BarrierRoundCoordinatorTest {
    private final BarrierRoundCoordinator sut = new BarrierRoundCoordinator();

    @Test
    void timedOutBarrierRejectsTheNextRoundImmediately() throws Exception {
        assertFalse(sut.reuseAfterTimeoutCompletes());
    }

    @Test
    void freshBarrierLetsTheNextRoundComplete() throws Exception {
        assertTrue(sut.freshBarrierCompletesNextRound());
    }
}
