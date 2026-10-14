package club.mockinterview.concurrency;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class PayoutPublisher implements AutoCloseable {
    private final Broker broker;
    private final AuditStore audit;
    private final ExecutorService auditIo;

    public PayoutPublisher(Broker broker, AuditStore audit) {
        this(broker, audit, null);
    }

    private PayoutPublisher(
            Broker broker, AuditStore audit, ExecutorService auditIo) {
        this.broker = Objects.requireNonNull(broker);
        this.audit = Objects.requireNonNull(audit);
        this.auditIo = auditIo;
    }

    public static PayoutPublisher withVirtualThreadAudits(
            Broker broker, AuditStore audit) {
        return new PayoutPublisher(
                broker, audit, Executors.newVirtualThreadPerTaskExecutor());
    }

    public CompletableFuture<Void> publish(List<Payout> payouts) {
        CompletableFuture<?>[] completions = payouts.stream()
                .map(this::sendAndAudit)
                .toArray(CompletableFuture<?>[]::new);
        return CompletableFuture.allOf(completions);
    }

    private CompletableFuture<Void> sendAndAudit(Payout payout) {
        CompletableFuture<Ack> send = broker.send(payout);
        if (auditIo == null) {
            return send.thenAccept(
                    ack -> audit.save(payout.id(), ack.offset()));
        }
        return send.thenAcceptAsync(
                ack -> audit.save(payout.id(), ack.offset()), auditIo);
    }

    @Override
    public void close() {
        if (auditIo != null) {
            auditIo.close();
        }
    }

    public record Payout(String id, long cents) {}
    public record Ack(long offset) {}

    @FunctionalInterface
    public interface Broker {
        CompletableFuture<Ack> send(Payout payout);
    }

    @FunctionalInterface
    public interface AuditStore {
        void save(String payoutId, long offset);
    }
}
