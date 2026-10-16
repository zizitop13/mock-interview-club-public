package club.mockinterview.algorithms;

public final class LongestBudgetWindow {
    private LongestBudgetWindow() {}

    public static int longest(int[] costs, long budget) {
        int left = 0;
        int best = 0;
        long sum = 0;

        for (int right = 0; right < costs.length; right++) {
            sum += costs[right];

            while (left <= right && sum > budget) {
                sum -= costs[left++];
            }

            best = Math.max(best, right - left + 1);
        }

        return best;
    }
}
