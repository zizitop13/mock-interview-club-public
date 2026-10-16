# Finding the longest bounded-sum window

## Correct answer

d. Advance right once; while the sum exceeds `K`, advance left, then record the window.

## Detailed explanation

The key observation is that every cost is non-negative. Extending a window to the right can never decrease its sum, and removing values from the left can never increase it. That monotonicity is exactly what makes a two-pointer sliding window correct.

Keep an inclusive left boundary and scan the right boundary from left to right. Add the new value to a `long` sum. While the sum is greater than `K`, remove the value at `left` and increment `left`. Once the loop stops, `[left, right]` is valid; record its length.

For a fixed `right`, the algorithm removes a left endpoint only when the window is invalid. Therefore, after shrinking, `[left, right]` is the longest valid window ending at `right`: any earlier start would restore values that made the sum exceed `K`. Taking the maximum over every `right` finds the globally longest valid segment.

In the example, the scan reaches indices 1 through 3 with values `[1,3,1]`. Their sum is exactly 5, so the window has length 3. Extending it to index 4 gives sum 6; removing the leftmost 1 restores a valid length-3 window `[3,1,1]`.

## Code example

```java
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
```

## Complexity

The right pointer advances `n` times, and the left pointer advances at most `n` times. Time complexity is O(n), and auxiliary space is O(1). A `long` sum is required because valid inputs may exceed the range of `int` when accumulated.

## Why the other options are incorrect

- a. Restarting the scan at every index can inspect the same elements repeatedly, taking O(n²) time and violating the required O(n) bound.
- b. Sorting destroys the original order, so the chosen values no longer necessarily form a contiguous segment.
- c. Kadane's algorithm optimizes a maximum-sum objective. Resetting the whole segment on overflow may discard a suffix that becomes valid after removing only a few leftmost values.
