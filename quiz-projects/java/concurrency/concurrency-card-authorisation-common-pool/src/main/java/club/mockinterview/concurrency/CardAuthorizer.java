package club.mockinterview.concurrency;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

public final class CardAuthorizer {
    private final Issuer issuer;

    public CardAuthorizer(Issuer issuer) {
        this.issuer = Objects.requireNonNull(issuer);
    }

    public CompletableFuture<Decision> authorizeOnCommonPool(Request request) {
        requireValid(request);
        return CompletableFuture.supplyAsync(() -> issuer.authorize(request));
    }

    public CompletableFuture<Decision> authorizeOn(
            Request request,
            Executor issuerExecutor) {
        requireValid(request);
        Objects.requireNonNull(issuerExecutor);
        try {
            return CompletableFuture.supplyAsync(
                    () -> issuer.authorize(request), issuerExecutor);
        } catch (RejectedExecutionException overloaded) {
            return CompletableFuture.failedFuture(overloaded);
        }
    }

    private static void requireValid(Request request) {
        Objects.requireNonNull(request);
        if (request.cents() <= 0) {
            throw new IllegalArgumentException("cents must be positive");
        }
    }

    public record Request(String cardId, long cents) {
        public Request {
            Objects.requireNonNull(cardId);
        }
    }

    public enum Decision {
        APPROVED,
        DECLINED
    }

    @FunctionalInterface
    public interface Issuer {
        Decision authorize(Request request);
    }
}
