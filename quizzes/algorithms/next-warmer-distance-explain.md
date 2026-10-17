# Finding the nearest warmer position

## Correct answer

b. Keep unresolved indices in a non-increasing stack; pop them when a higher value arrives.

## Detailed explanation

The key observation is that an index remains unresolved only until the first later, strictly higher temperature appears. Process indices from left to right and keep unresolved indices in a stack whose temperatures are non-increasing from bottom to top.

At index `i`, compare the current temperature with the index on top of the stack. While the current value is strictly higher, pop that earlier index `j` and set `answer[j] = i - j`. Continue because the same current value may also resolve older, smaller temperatures. Then push `i` for a future value to resolve.

The strict `>` comparison matters. Equal temperatures stay on the stack because an equal value is not warmer.

Why is the answer for a popped index the nearest valid one? Suppose `i` pops `j`. Every position between `j` and `i` has already been processed. If any of those positions had been strictly warmer than `j`, it would have popped `j` earlier. Therefore `i` is the first later strictly warmer position. Indices left in the stack have no later warmer value and correctly keep the initialized answer `0`.

For `[73,74,71,75]`:

1. Push index 0.
2. At index 1, `74 > 73`, so set `answer[0] = 1` and push 1.
3. At index 2, `71` is not greater than `74`, so push 2.
4. At index 3, `75` pops index 2 and then index 1, producing distances 1 and 2.

The final result is `[1,2,1,0]`.

## Code example

```java
package club.mockinterview.algorithms;

import java.util.ArrayDeque;
import java.util.Deque;

public final class NextWarmerDistance {
    private NextWarmerDistance() {}

    public static int[] distances(int[] temperatures) {
        int[] answer = new int[temperatures.length];
        Deque<Integer> unresolved = new ArrayDeque<>();

        for (int i = 0; i < temperatures.length; i++) {
            while (!unresolved.isEmpty()
                    && temperatures[i] > temperatures[unresolved.peek()]) {
                int previous = unresolved.pop();
                answer[previous] = i - previous;
            }
            unresolved.push(i);
        }

        return answer;
    }
}
```

## Complexity

Each index is pushed once and popped at most once, so the time complexity is O(n). The stack and result array use O(n) space; auxiliary stack space is O(n) in the worst case.

## Why the other options are incorrect

- a. It finds the correct position, but a decreasing input makes it inspect O(n²) pairs, violating the required O(n) time.
- c. Sorting loses the original nearest-position relationship; adjacent temperatures in sorted order need not be adjacent indices.
- d. A suffix maximum can be warmer but farther away than another warmer value, so its position need not be the nearest valid answer.
