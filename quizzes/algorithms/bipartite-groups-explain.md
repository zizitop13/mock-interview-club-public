# Checking whether a graph is bipartite

## Correct answer

a. Two-color every component with BFS/DFS, using opposite colors across edges; reject conflicts.

## Detailed explanation

The key observation is that every edge fixes a relationship between its endpoints: they must receive opposite colors. Start any uncolored vertex with color 0, traverse its connected component, and assign each newly discovered neighbor color `1 - color[current]`.

For every edge `u–v`:

1. If `v` is uncolored, give it the opposite color from `u` and enqueue it.
2. If `v` already has the same color as `u`, return `false`.
3. Otherwise, the edge already satisfies the required split.

The graph may be disconnected, so repeat the traversal from every still-uncolored vertex. Isolated vertices simply start and finish their own component. Parallel edges repeat the same consistent constraint. A self-loop immediately compares a vertex with itself and correctly returns `false`.

In the example, component `0–1–2–3–0` alternates A, B, A, B around an even cycle. Component `4–5` independently receives A, B. Thus `{0,2,4} | {1,3,5}` is a valid split.

Why is the test correct? If traversal succeeds, every inspected edge joins opposite colors, so the two color classes are the required groups. If an edge joins equal colors, the two traversal paths from the component's start to its endpoints, together with that edge, form an odd cycle. An odd cycle cannot alternate between two groups, so no valid split exists.

## Code example

```java
package club.mockinterview.algorithms;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;

public final class BipartiteGroups {
    private BipartiteGroups() {}

    public static boolean canSplit(int vertexCount, int[][] edges) {
        List<List<Integer>> neighbors = new ArrayList<>(vertexCount);
        for (int vertex = 0; vertex < vertexCount; vertex++) {
            neighbors.add(new ArrayList<>());
        }

        for (int[] edge : edges) {
            int left = edge[0];
            int right = edge[1];
            neighbors.get(left).add(right);
            neighbors.get(right).add(left);
        }

        int[] color = new int[vertexCount];
        Arrays.fill(color, -1);
        Deque<Integer> queue = new ArrayDeque<>();

        for (int start = 0; start < vertexCount; start++) {
            if (color[start] != -1) {
                continue;
            }

            color[start] = 0;
            queue.add(start);

            while (!queue.isEmpty()) {
                int current = queue.remove();
                for (int neighbor : neighbors.get(current)) {
                    if (color[neighbor] == -1) {
                        color[neighbor] = 1 - color[current];
                        queue.add(neighbor);
                    } else if (color[neighbor] == color[current]) {
                        return false;
                    }
                }
            }
        }

        return true;
    }
}
```

## Complexity

Building the adjacency list takes O(n+m) time and space. Each vertex is colored once and each undirected edge is inspected twice, so traversal is O(n+m). The adjacency list, color array, and queue use O(n+m) space.

## Why the other options are incorrect

- b. Ordinary union-find tracks connectivity, not parity. Rejecting an edge whose endpoints are already connected rejects even cycles such as the valid four-cycle in the example; parity-aware union-find would be a different algorithm.
- c. Replacing an undirected edge with both orientations creates a directed two-cycle for every edge, so topological sorting rejects every nonempty graph regardless of bipartiteness.
- d. Starting only at vertex 0 misses disconnected components, and checking only parent edges does not detect an edge joining two vertices at the same color level.
