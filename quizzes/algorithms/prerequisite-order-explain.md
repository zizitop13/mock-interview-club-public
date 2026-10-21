# Ordering tasks with Kahn's algorithm

## Correct answer

d. Queue every zero-indegree vertex; remove it, decrement successors, and require n removals.

## Detailed explanation

The key observation is that a task is safe to schedule exactly when its indegree is zero: no unprocessed prerequisite points to it. Kahn's algorithm maintains this set of ready tasks while removing the graph one vertex at a time.

Build an adjacency list and count every incoming edge. Put every zero-indegree vertex in a queue. Then repeatedly:

1. Remove one ready vertex and append it to the result.
2. Treat each outgoing edge as removed by decrementing its destination's indegree.
3. Enqueue a destination when its indegree becomes zero.

For the example, vertices 0 and 1 are initially ready. Removing both makes vertices 2 and 3 ready; removing 2 and 3 then unlocks vertex 4. This produces `[0,1,2,3,4]`. A different queue order could produce another valid result, which the problem explicitly accepts.

Every emitted vertex has indegree zero at that moment, so all its prerequisites were emitted earlier. Therefore the result never violates an edge `u→v`. Conversely, every acyclic directed graph contains at least one zero-indegree vertex; after removing one, the remaining graph is still acyclic. Repeating must therefore emit all `n` vertices.

If the queue becomes empty before `n` vertices are emitted, every remaining vertex has an incoming edge from the remaining graph. Following those incoming edges must eventually repeat a vertex, proving that a directed cycle remains. Returning an empty array is therefore correct.

## Code example

```java
package club.mockinterview.algorithms;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

public final class PrerequisiteOrder {
    private PrerequisiteOrder() {}

    public static int[] order(int taskCount, int[][] edges) {
        List<List<Integer>> successors = new ArrayList<>(taskCount);
        for (int task = 0; task < taskCount; task++) {
            successors.add(new ArrayList<>());
        }

        int[] indegree = new int[taskCount];
        for (int[] edge : edges) {
            successors.get(edge[0]).add(edge[1]);
            indegree[edge[1]]++;
        }

        Deque<Integer> ready = new ArrayDeque<>();
        for (int task = 0; task < taskCount; task++) {
            if (indegree[task] == 0) {
                ready.add(task);
            }
        }

        int[] result = new int[taskCount];
        int size = 0;

        while (!ready.isEmpty()) {
            int completed = ready.remove();
            result[size++] = completed;

            for (int successor : successors.get(completed)) {
                indegree[successor]--;
                if (indegree[successor] == 0) {
                    ready.add(successor);
                }
            }
        }

        return size == taskCount ? result : new int[0];
    }
}
```

## Complexity

Building the adjacency list and indegrees takes O(n+m) time. Every vertex enters and leaves the queue once, and every edge is decremented once, so the traversal is O(n+m). The adjacency list, indegree array, queue, and result use O(n+m) space; auxiliary graph state excluding the input and output is O(n+m).

## Why the other options are incorrect

- a. BFS discovery order only follows reachability from vertex 0; it misses disconnected tasks and does not enforce all prerequisites.
- b. Outdegree says how many dependents a task has, not whether its own prerequisites are complete, so sorting by it can violate edges.
- c. Shortest-path distances do not encode prerequisite completion, and concatenated traversals can duplicate tasks or place a task before a prerequisite.
