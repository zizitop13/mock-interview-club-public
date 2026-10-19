package club.mockinterview.algorithms;

public final class MinimumShippingCapacity {
    private MinimumShippingCapacity() {}

    public static long minimum(long[] weights, int maxDays) {
        long low = 0;
        long high = 0;

        for (long weight : weights) {
            low = Math.max(low, weight);
            high += weight;
        }

        while (low < high) {
            long middle = low + (high - low) / 2;
            if (requiredDays(weights, middle) <= maxDays) {
                high = middle;
            } else {
                low = middle + 1;
            }
        }

        return low;
    }

    private static int requiredDays(long[] weights, long capacity) {
        int days = 1;
        long load = 0;

        for (long weight : weights) {
            if (load + weight > capacity) {
                days++;
                load = 0;
            }
            load += weight;
        }

        return days;
    }
}
