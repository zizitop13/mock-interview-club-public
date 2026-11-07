package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PhaserBatchTest {
    private final PhaserBatch sut = new PhaserBatch();

    @Test
    void earlyReturnLeavesARegisteredPartyBehind() throws Exception {
        AtomicInteger processed = new AtomicInteger();

        PhaserBatch.Result result = sut.broken(
                List.of(new PhaserBatch.Job(true), new PhaserBatch.Job(false)),
                ignored -> processed.incrementAndGet());

        assertEquals(1, processed.get());
        assertFalse(result.phaseCompleted());
        assertEquals(1, result.registeredParties());
    }

    @Test
    void finallyDeregistersValidAndRejectedTasks() throws Exception {
        AtomicInteger processed = new AtomicInteger();

        PhaserBatch.Result result = sut.fixed(
                List.of(new PhaserBatch.Job(true), new PhaserBatch.Job(false)),
                ignored -> processed.incrementAndGet());

        assertEquals(1, processed.get());
        assertTrue(result.phaseCompleted());
        assertEquals(0, result.registeredParties());
    }
}
