package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class ConnectionGateTest {
    @Test
    void signalBeforeAwaitIsNotRemembered() throws Exception {
        ConnectionGate gate = new ConnectionGate();
        gate.brokenSignalOnly();

        Thread waiter = Thread.ofVirtual().start(() -> {
            try {
                gate.brokenAwaitConnected();
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
        });

        awaitWaiterRegistration(gate);
        assertTrue(waiter.isAlive());

        waiter.interrupt();
        waiter.join();
        assertFalse(waiter.isAlive());
    }

    @Test
    void statePredicateRemembersAnEarlyConnection() throws Exception {
        ConnectionGate gate = new ConnectionGate();
        gate.fixedMarkConnected();

        gate.fixedAwaitConnected();
        assertFalse(gate.hasConditionWaiters());
    }

    private static void awaitWaiterRegistration(ConnectionGate gate) {
        long deadline = System.nanoTime() + Duration.ofSeconds(2).toNanos();
        while (!gate.hasConditionWaiters() && System.nanoTime() < deadline) {
            Thread.onSpinWait();
        }
        assertTrue(gate.hasConditionWaiters());
    }
}
