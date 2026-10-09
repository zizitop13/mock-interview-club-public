package club.mockinterview.concurrency;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

public final class SubscriptionRenewalService {
    private final Gateway gateway;
    private final boolean singleFlight;
    private final ConcurrentHashMap<String, Receipt> completed =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CompletableFuture<Receipt>> renewals =
            new ConcurrentHashMap<>();

    public SubscriptionRenewalService(Gateway gateway) {
        this(gateway, false);
    }

    private SubscriptionRenewalService(Gateway gateway, boolean singleFlight) {
        this.gateway = Objects.requireNonNull(gateway);
        this.singleFlight = singleFlight;
    }

    public static SubscriptionRenewalService withSingleFlight(Gateway gateway) {
        return new SubscriptionRenewalService(gateway, true);
    }

    public Receipt renew(String renewalId, long cents) {
        Objects.requireNonNull(renewalId);
        return singleFlight
                ? renewOnce(renewalId, cents)
                : renewWithCheckThenAct(renewalId, cents);
    }

    private Receipt renewWithCheckThenAct(String renewalId, long cents) {
        Receipt previous = completed.get(renewalId);
        if (previous != null) {
            return previous;
        }

        Receipt charged = gateway.charge(renewalId, cents);
        completed.put(renewalId, charged);
        return charged;
    }

    private Receipt renewOnce(String renewalId, long cents) {
        CompletableFuture<Receipt> mine = new CompletableFuture<>();
        CompletableFuture<Receipt> existing = renewals.putIfAbsent(
                renewalId,
                mine);
        if (existing != null) {
            return existing.join();
        }

        try {
            Receipt receipt = gateway.charge(renewalId, cents);
            mine.complete(receipt);
            return receipt;
        } catch (RuntimeException failureBeforeCharge) {
            mine.completeExceptionally(failureBeforeCharge);
            renewals.remove(renewalId, mine);
            throw failureBeforeCharge;
        }
    }

    public interface Gateway {
        Receipt charge(String renewalId, long cents);
    }

    public record Receipt(String receiptId, long cents) {
        public Receipt {
            Objects.requireNonNull(receiptId);
        }
    }
}
