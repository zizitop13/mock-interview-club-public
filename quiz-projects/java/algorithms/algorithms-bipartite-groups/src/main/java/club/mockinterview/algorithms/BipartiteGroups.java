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
