package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class PayoutPublisherTest {
    private static final List<PayoutPublisher.Payout> PAYOUTS = List.of(
            new PayoutPublisher.Payout("payout-1", 1_000),
            new PayoutPublisher.Payout("payout-2", 2_000));

    @Test
    void blockingAuditStallsTheSingleBrokerCompletionThread() throws Exception {
        try (ManualBroker broker = new ManualBroker();
             PayoutPublisher publisher =
                     new PayoutPublisher(broker, broker.audit())) {
            CompletableFuture<Void> published = publisher.publish(PAYOUTS);

            Future<?> firstAck = broker.acknowledge(0);
            assertTrue(broker.audit().awaitFirstStarted());
            Future<?> secondAck = broker.acknowledge(1);

            assertFalse(firstAck.isDone());
            assertFalse(secondAck.isDone());
            assertFalse(broker.audit().secondSaved());

            broker.audit().releaseFirst();
            firstAck.get(2, TimeUnit.SECONDS);
            secondAck.get(2, TimeUnit.SECONDS);
            published.get(2, TimeUnit.SECONDS);
            assertFalse(broker.audit().allWritesUsedVirtualThreads());
        }
    }

    @Test
    void virtualThreadAuditLeavesBrokerCompletionsUnblocked() throws Exception {
        try (ManualBroker broker = new ManualBroker();
             PayoutPublisher publisher = PayoutPublisher.withVirtualThreadAudits(
                     broker, broker.audit())) {
            CompletableFuture<Void> published = publisher.publish(PAYOUTS);

            broker.acknowledge(0).get(2, TimeUnit.SECONDS);
            assertTrue(broker.audit().awaitFirstStarted());
            broker.acknowledge(1).get(2, TimeUnit.SECONDS);

            assertTrue(broker.audit().awaitSecondSaved());
            assertTrue(broker.audit().allWritesUsedVirtualThreads());

            broker.audit().releaseFirst();
            published.get(2, TimeUnit.SECONDS);
        }
    }

    private static final class ManualBroker
            implements PayoutPublisher.Broker, AutoCloseable {
        private final ExecutorService io = Executors.newSingleThreadExecutor(
                Thread.ofPlatform().name("broker-io").factory());
        private final List<CompletableFuture<PayoutPublisher.Ack>> sends =
                new ArrayList<>();
        private final BlockingAuditStore audit = new BlockingAuditStore();

        @Override
        public synchronized CompletableFuture<PayoutPublisher.Ack> send(
                PayoutPublisher.Payout payout) {
            CompletableFuture<PayoutPublisher.Ack> future =
                    new CompletableFuture<>();
            sends.add(future);
            return future;
        }

        synchronized Future<?> acknowledge(int index) {
            return io.submit(() -> sends.get(index).complete(
                    new PayoutPublisher.Ack(index)));
        }

        BlockingAuditStore audit() {
            return audit;
        }

        @Override
        public void close() {
            io.close();
        }
    }

    private static final class BlockingAuditStore
            implements PayoutPublisher.AuditStore {
        private final CountDownLatch firstStarted = new CountDownLatch(1);
        private final CountDownLatch releaseFirst = new CountDownLatch(1);
        private final CountDownLatch secondSaved = new CountDownLatch(1);
        private final List<Boolean> virtualThreads =
                java.util.Collections.synchronizedList(new ArrayList<>());

        @Override
        public void save(String payoutId, long offset) {
            virtualThreads.add(Thread.currentThread().isVirtual());
            if (payoutId.equals("payout-1")) {
                firstStarted.countDown();
                await(releaseFirst);
            } else {
                secondSaved.countDown();
            }
        }

        boolean awaitFirstStarted() throws InterruptedException {
            return firstStarted.await(2, TimeUnit.SECONDS);
        }

        boolean awaitSecondSaved() throws InterruptedException {
            return secondSaved.await(2, TimeUnit.SECONDS);
        }

        boolean secondSaved() {
            return secondSaved.getCount() == 0;
        }

        void releaseFirst() {
            releaseFirst.countDown();
        }

        boolean allWritesUsedVirtualThreads() {
            synchronized (virtualThreads) {
                return virtualThreads.size() == 2
                        && virtualThreads.stream().allMatch(Boolean::booleanValue);
            }
        }

        private static void await(CountDownLatch latch) {
            try {
                latch.await();
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(interrupted);
            }
        }
    }
}
