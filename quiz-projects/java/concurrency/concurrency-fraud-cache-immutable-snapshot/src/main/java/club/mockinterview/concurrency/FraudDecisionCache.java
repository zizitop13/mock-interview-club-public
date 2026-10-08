package club.mockinterview.concurrency;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public final class FraudDecisionCache {
    private static final int BLOCK_SCORE = 80;

    private final boolean replaceSnapshots;
    private final Runnable refreshBoundary;
    private volatile Map<String, Integer> scores;

    public FraudDecisionCache() {
        this(false, Map.of(), () -> {});
    }

    private FraudDecisionCache(
            boolean replaceSnapshots,
            Map<String, Integer> initialScores,
            Runnable refreshBoundary) {
        this.replaceSnapshots = replaceSnapshots;
        this.refreshBoundary = Objects.requireNonNull(refreshBoundary);
        this.scores = replaceSnapshots
                ? Map.copyOf(initialScores)
                : new HashMap<>(initialScores);
    }

    public static FraudDecisionCache withImmutableSnapshots() {
        return new FraudDecisionCache(true, Map.of(), () -> {});
    }

    static FraudDecisionCache usingMutableMap(
            Map<String, Integer> initialScores,
            Runnable refreshBoundary) {
        return new FraudDecisionCache(false, initialScores, refreshBoundary);
    }

    static FraudDecisionCache usingImmutableSnapshots(
            Map<String, Integer> initialScores,
            Runnable refreshBoundary) {
        return new FraudDecisionCache(true, initialScores, refreshBoundary);
    }

    public void refresh(Map<String, Integer> nextScores) {
        Objects.requireNonNull(nextScores);

        if (replaceSnapshots) {
            Map<String, Integer> snapshot = Map.copyOf(nextScores);
            refreshBoundary.run();
            scores = snapshot;
            return;
        }

        scores.clear();
        refreshBoundary.run();
        scores.putAll(nextScores);
    }

    public boolean shouldBlock(String cardId) {
        return scores.getOrDefault(cardId, 0) >= BLOCK_SCORE;
    }
}
