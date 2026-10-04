package club.mockinterview.concurrency;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

public final class TradingQuoteCache {
    private final AtomicReference<Quote> latest =
            new AtomicReference<>(new Quote(0, 0));
    private final Consumer<Quote> beforeUnsafePublish;

    public TradingQuoteCache() {
        this(quote -> { });
    }

    TradingQuoteCache(Consumer<Quote> beforeUnsafePublish) {
        this.beforeUnsafePublish = Objects.requireNonNull(beforeUnsafePublish);
    }

    public void publishUnconditionally(Quote quote) {
        Quote incoming = Objects.requireNonNull(quote);
        beforeUnsafePublish.accept(incoming);
        latest.set(incoming);
    }

    public void publishHighest(Quote quote) {
        Quote incoming = Objects.requireNonNull(quote);
        latest.accumulateAndGet(incoming, (stored, candidate) ->
                candidate.sequence() > stored.sequence()
                        ? candidate
                        : stored);
    }

    public Quote current() {
        return latest.get();
    }

    public record Quote(long sequence, long priceMicros) {}
}
