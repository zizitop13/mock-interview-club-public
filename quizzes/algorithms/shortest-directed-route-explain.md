# Finding the fewest directed hops

## Correct answer

c. Run BFS from `s`, assigning each vertex the first distance at which it is enqueued.

## Detailed explanation

The key observation is that every edge has the same cost: one hop. Breadth-first search explores the graph in layers, first visiting vertices one edge from `s`, then vertices two edges away, and so on.

Build an adjacency list that preserves each edge's direction. Initialize every distance to `-1`, set `distance[s] = 0`, and enqueue `s`. Whenever BFS follows an edge from `u` to an undiscovered vertex `v`, assign `distance[v] = distance[u] + 1` and enqueue `v`. Marking a vertex when it is enqueued prevents cycles, self-loops, and parallel edges from adding it repeatedly.

The first assigned distance is optimal. When BFS removes a vertex at distance `k`, all queued vertices with smaller distances have already been processed. Therefore, discovering `v` from that vertex gives a path of length `k + 1`, and no shorter undiscovered path to `v` can still exist. By induction over BFS layers, every assigned value is the minimum number of directed edges from `s`.

For the example, BFS starts at vertex 0. It assigns distance 1 to vertices 1 and 2. Processing vertex 1 discovers vertex 4 at distance 2, so the result is 2 through `0→1→4`; the longer route through vertices 2 and 3 cannot replace it.

## Code example

```java
package club.mockinterview.algorithms;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;

public final class ShortestDirectedRoute {
    private ShortestDirectedRoute() {}

    public static int minEdges(int n, int[][] edges, int source, int target) {
        List<List<Integer>> graph = new ArrayList<>(n);
        for (int vertex = 0; vertex < n; vertex++) {
            graph.add(new ArrayList<>());
        }
        for (int[] edge : edges) {
            graph.get(edge[0]).add(edge[1]);
        }

        int[] distance = new int[n];
        Arrays.fill(distance, -1);
        distance[source] = 0;

        Deque<Integer> queue = new ArrayDeque<>();
        queue.add(source);

        while (!queue.isEmpty()) {
            int current = queue.remove();
            if (current == target) {
                return distance[current];
            }

            for (int next : graph.get(current)) {
                if (distance[next] == -1) {
                    distance[next] = distance[current] + 1;
                    queue.add(next);
                }
            }
        }

        return -1;
    }
}
```

## Complexity

Building and traversing the adjacency list takes O(n+m) time. Each vertex is enqueued at most once, and each directed edge is inspected once. The adjacency list, distance array, and queue use O(n+m) space.

## Why the other options are incorrect

- a. The first route found by DFS depends on adjacency order and may be longer than another route that has not yet been explored.
- b. Bellman-Ford can compute the distance but takes O(nm) time here, violating the required O(n+m) bound.
- d. Dijkstra is correct for unit weights but takes O((n+m) log n) with a priority queue, so it misses the required linear bound and adds unnecessary machinery.
