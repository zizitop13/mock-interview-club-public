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
