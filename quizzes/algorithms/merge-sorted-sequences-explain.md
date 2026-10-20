# Merging sorted sequences with a min-heap

## Correct answer

c. Keep one current value per non-empty array in a min-heap; pop and replace until empty.

## Detailed explanation

The key observation is that the next output value must be the smallest unconsumed value among the arrays. Because every input array is already sorted, that candidate is always the current head of its array. Values farther inside an array cannot be selected before its head.

Initialize a min-heap with index `0` from every non-empty array. Each heap entry records the value, source-array index, and element index. Repeatedly:

1. Remove the smallest heap entry and append its value to the output.
2. Advance only that entry's source array.
3. If the source still has a value, insert its new current head into the heap.

For the example, the heap initially contains `1(A), 1(B), 2(C)`. Removing `1(A)` appends the first output value and exposes `4(A)`. The heap then contains `1(B), 2(C), 4(A)`. Repeating this operation produces `[1,1,2,3,4,4,6]`; separate entries preserve both copies of `1` and both copies of `4`.

The heap invariant is: it contains exactly the smallest unconsumed value from every non-empty remaining suffix. Therefore its minimum is the smallest unconsumed value globally. Appending that value keeps the output sorted, and replacing it with the next value from the same array restores the invariant. By induction, every emitted value is correct, and every input value is emitted exactly once.

## Code example

```java
package club.mockinterview.algorithms;

import java.util.Comparator;
import java.util.PriorityQueue;

public final class MergeSortedSequences {
    private MergeSortedSequences() {}

    public static int[] merge(int[][] sequences) {
        int totalSize = 0;
        PriorityQueue<Entry> heads = new PriorityQueue<>(
                Comparator.comparingInt(Entry::value)
                        .thenComparingInt(Entry::sequence));

        for (int sequence = 0; sequence < sequences.length; sequence++) {
            totalSize += sequences[sequence].length;
            if (sequences[sequence].length > 0) {
                heads.add(new Entry(sequences[sequence][0], sequence, 0));
            }
        }

        int[] merged = new int[totalSize];
        int outputIndex = 0;

        while (!heads.isEmpty()) {
            Entry smallest = heads.remove();
            merged[outputIndex++] = smallest.value();

            int nextIndex = smallest.index() + 1;
            int[] source = sequences[smallest.sequence()];
            if (nextIndex < source.length) {
                heads.add(new Entry(
                        source[nextIndex],
                        smallest.sequence(),
                        nextIndex));
            }
        }

        return merged;
    }

    private record Entry(int value, int sequence, int index) {}
}
```

## Complexity

The heap contains at most one entry per input array, so its size is at most `k`. Each of the `N` values is removed once and causes at most one insertion. Both operations cost O(log k), giving O(N log k) time and O(k) auxiliary space, excluding the output.

## Why the other options are incorrect

- a. Comparison-sorting all values costs O(N log N), which exceeds the required bound when `k` is much smaller than `N`.
- b. A skip list stores all `N` values and takes expected O(N log N) insertion time, violating both required bounds for small `k`.
- d. Scanning up to `k` heads before every output value takes O(Nk) time rather than O(N log k).
