package club.mockinterview.observability;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public final class FleetPercentiles {
    private FleetPercentiles() {
    }

    public static long nearestRank(Collection<Long> samples, double quantile) {
        if (samples.isEmpty()) {
            throw new IllegalArgumentException("samples must not be empty");
        }
        if (quantile <= 0.0 || quantile > 1.0) {
            throw new IllegalArgumentException("quantile must be in (0, 1]");
        }

        long[] sorted = samples.stream()
                .mapToLong(Long::longValue)
                .sorted()
                .toArray();
        int index = (int) Math.ceil(quantile * sorted.length) - 1;
        return sorted[index];
    }

    public static double weightedAverageOfLocalPercentiles(
            List<? extends Collection<Long>> pods,
            double quantile) {
        long totalCount = pods.stream().mapToLong(Collection::size).sum();
        if (totalCount == 0) {
            throw new IllegalArgumentException("pods must contain samples");
        }

        double weightedTotal = pods.stream()
                .mapToDouble(samples -> nearestRank(samples, quantile) * samples.size())
                .sum();
        return weightedTotal / totalCount;
    }

    public static long percentileAfterMerging(
            List<? extends Collection<Long>> pods,
            double quantile) {
        List<Long> merged = new ArrayList<>();
        pods.forEach(merged::addAll);
        return nearestRank(merged, quantile);
    }
}
