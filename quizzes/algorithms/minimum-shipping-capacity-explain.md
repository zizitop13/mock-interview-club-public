# Finding the minimum shipping capacity

## Correct answer

a. Binary-search capacity from the heaviest package to the total, using a greedy day count.

## Detailed explanation

The key observation is monotonicity. If all packages can be shipped within `D` days using capacity `C`, then every capacity larger than `C` is also feasible. That creates a false-to-true boundary over the possible capacities, which binary search can locate.

The lowest possible capacity is the heaviest single package because packages cannot be split. The total weight is always a feasible upper bound because it ships everything in one day.

To test a candidate capacity, scan the packages in their original order. Add each package to the current day when it fits; otherwise start a new day with that package. This greedy packing uses the fewest days possible for that fixed capacity: each day takes the longest available prefix that fits, so ending any day earlier cannot allow more packages to be shipped by that point.

Binary search maintains a range containing the minimum feasible capacity. If the greedy scan needs at most `D` days, the candidate is feasible and becomes the new upper bound. Otherwise, the minimum must be larger than the candidate.

For `[3,2,2,4,1,4]`, capacity 5 needs four days: `[3,2]`, `[2]`, `[4,1]`, `[4]`. Capacity 6 needs three days: `[3,2]`, `[2,4]`, `[1,4]`. Since every smaller candidate is infeasible and 6 is feasible, the answer is 6.

## Code example

```java
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
```

## Complexity

Each feasibility test takes O(n) time and O(1) auxiliary space. Binary search performs O(log S) tests, so the total time is O(n log S) and auxiliary space is O(1). The bounds and running load use `long` because the sum can exceed `int`.

## Why the other options are incorrect

- b. Sorting destroys the required package order, so the balanced assignment may not represent consecutive shipping days.
- c. Independent windows do not choose a globally valid partition or locate the minimum feasible capacity.
- d. Trying every earlier split for every prefix and day takes O(Dn²) time, far beyond the required bound.
