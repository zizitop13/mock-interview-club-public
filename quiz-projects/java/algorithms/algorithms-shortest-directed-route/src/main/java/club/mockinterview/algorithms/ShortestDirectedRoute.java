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
