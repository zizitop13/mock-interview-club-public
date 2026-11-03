package club.mockinterview.concurrency;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import java.util.function.Function;

public final class ReviewPipeline {
    public record Decision(boolean approved, String reason) {
        public static Decision approved(String reason) {
            return new Decision(true, reason);
        }
    }

    public CompletionStage<Void> broken(
            CompletionStage<Integer> riskScore,
            Function<Integer, Decision> decide,
            Consumer<Decision> reserveInventory,
            Consumer<Decision> publishApproved) {
        return riskScore
                .thenApply(decide)
                .exceptionally(error -> Decision.approved("fallback"))
                .thenApply(decision -> {
                    reserveInventory.accept(decision);
                    return decision;
                })
                .thenAccept(publishApproved);
    }

    public CompletionStage<Void> fixed(
            CompletionStage<Integer> riskScore,
            Function<Integer, Decision> decide,
            Consumer<Throwable> alert,
            Consumer<Decision> reserveInventory,
            Consumer<Decision> publishApproved) {
        return riskScore
                .thenApply(decide)
                .whenComplete((decision, error) -> {
                    if (error != null) {
                        alert.accept(error);
                    }
                })
                .thenApply(decision -> {
                    reserveInventory.accept(decision);
                    return decision;
                })
                .thenAccept(publishApproved);
    }

    public static CompletionStage<Integer> failedRiskCheck() {
        return CompletableFuture.failedFuture(new IllegalStateException("risk service unavailable"));
    }
}
