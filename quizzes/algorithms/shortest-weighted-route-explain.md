# Finding a shortest weighted route with Dijkstra's algorithm

## Correct answer

b. Use Dijkstra with a min-heap; relax outgoing edges and discard stale heap entries.

## Detailed explanation

The key observation is that all edge weights are nonnegative. Therefore, when an unsettled vertex with the smallest known distance is removed from a min-heap, no later route through a farther vertex can improve it. Dijkstra's algorithm uses exactly this ordering.

Build an adjacency list and initialize every distance to infinity except `distance[s] = 0`. Store `(vertex, distance)` states in a min-heap. Then repeatedly:

1. Remove the state with the smallest distance.
2. Skip it if its distance no longer equals the best distance stored for that vertex.
3. For every outgoing edge, compute the candidate distance and update the destination if it is smaller.
4. Return when `t` is removed with its current best distance; return `-1` if the heap empties first.

In the example, vertex 2 is reached from 0 with distance 1. Relaxing `2→1(2)` improves vertex 1 from 4 to 3. Vertex 1 then improves vertex 3 to 4, beating the direct continuation `0→2→3` with weight 8. The older heap entry `(1,4)` is stale and is ignored if it is later removed.

For correctness, suppose the current heap minimum is vertex `u` at distance `d`. Any alternative route to `u` through an unsettled vertex must first reach a vertex whose distance is at least `d`; adding a nonnegative edge cannot produce a value below `d`. Thus `d` is final. Relaxing all outgoing edges preserves the best known route to every frontier vertex, so the algorithm eventually returns the shortest reachable distance to `t`.

## Code example

```java
package club.mockinterview.algorithms;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.PriorityQueue;

public final class WeightedShortestRoute {
    private WeightedShortestRoute() {}

    private record Edge(int to, long weight) {}

    private record State(int vertex, long distance) implements Comparable<State> {
        @Override
        public int compareTo(State other) {
            return Long.compare(distance, other.distance);
        }
    }

    public static long shortestDistance(
            int vertexCount, int[][] edges, int source, int target) {
        List<List<Edge>> outgoing = new ArrayList<>(vertexCount);
        for (int vertex = 0; vertex < vertexCount; vertex++) {
            outgoing.add(new ArrayList<>());
        }

        for (int[] edge : edges) {
            outgoing.get(edge[0]).add(new Edge(edge[1], edge[2]));
        }

        long[] distance = new long[vertexCount];
        Arrays.fill(distance, Long.MAX_VALUE);
        distance[source] = 0;

        PriorityQueue<State> heap = new PriorityQueue<>();
        heap.add(new State(source, 0));

        while (!heap.isEmpty()) {
            State current = heap.remove();
            if (current.distance() != distance[current.vertex()]) {
                continue;
            }
            if (current.vertex() == target) {
                return current.distance();
            }

            for (Edge edge : outgoing.get(current.vertex())) {
                long candidate = current.distance() + edge.weight();
                if (candidate < distance[edge.to()]) {
                    distance[edge.to()] = candidate;
                    heap.add(new State(edge.to(), candidate));
                }
            }
        }

        return -1;
    }
}
```

## Complexity

Building the adjacency list takes O(n+m) time and space. Each successful relaxation inserts one heap entry, and every entry is removed once, so the traversal is O((n+m) log(n+m)) with O(n+m) space for the graph, distances, and heap.

## Why the other options are incorrect

- a. BFS minimizes the number of edges, not their total weight. First discovery is only final when every edge has the same weight.
- c. Bellman-Ford handles negative weights, but O(nm) time does not meet the required O((n+m) log(n+m)) bound for these constraints.
- d. Union-find ignores edge direction and path-weight sums. Sorting until connectivity solves neither directed reachability nor shortest total distance.
