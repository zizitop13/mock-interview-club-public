package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

class MerchantCaptureTest {
    @Test
    void restartingTheTimeoutLetsRetriesExceedTheRequestBudget() {
        FakeNanoClock clock = new FakeNanoClock();
        TimingOutProcessor processor = new TimingOutProcessor(clock, 200);
        MerchantCapture capture = new MerchantCapture(processor, clock::read);

        assertThrows(
                TimeoutException.class,
                () -> capture.captureWithRestartedTimeout("payment-7"));

        assertEquals(
                List.of(Duration.ofMillis(300),
                        Duration.ofMillis(300),
                        Duration.ofMillis(300)),
                processor.receivedTimeouts());
        assertEquals(Duration.ofMillis(600).toNanos(), clock.read());
    }

    @Test
    void oneDeadlineCapsAllRetryAllowances() {
        FakeNanoClock clock = new FakeNanoClock();
        TimingOutProcessor processor = new TimingOutProcessor(clock, 200);
        MerchantCapture capture = new MerchantCapture(processor, clock::read);

        assertThrows(
                TimeoutException.class,
                () -> capture.captureWithinDeadline("payment-7"));

        assertEquals(
                List.of(Duration.ofMillis(300), Duration.ofMillis(100)),
                processor.receivedTimeouts());
        assertEquals(Duration.ofMillis(300).toNanos(), clock.read());
    }

    private static final class TimingOutProcessor
            implements MerchantCapture.Processor {
        private final FakeNanoClock clock;
        private final long workNanos;
        private final List<Duration> receivedTimeouts = new ArrayList<>();

        private TimingOutProcessor(FakeNanoClock clock, long workMillis) {
            this.clock = clock;
            this.workNanos = Duration.ofMillis(workMillis).toNanos();
        }

        @Override
        public String capture(String paymentId, Duration timeout)
                throws TimeoutException {
            receivedTimeouts.add(timeout);
            clock.advance(Math.min(workNanos, timeout.toNanos()));
            throw new TimeoutException("processor did not answer");
        }

        private List<Duration> receivedTimeouts() {
            return List.copyOf(receivedTimeouts);
        }
    }

    private static final class FakeNanoClock {
        private final AtomicLong now = new AtomicLong();

        private long read() {
            return now.get();
        }

        private void advance(long nanos) {
            now.addAndGet(nanos);
        }
    }
}
