package club.mockinterview.algorithms;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ShortestDirectedRouteTest {
    @Test
    void findsTheShortestRouteInTheWorkedExample() {
        int[][] edges = {{0, 1}, {0, 2}, {1, 4}, {2, 3}, {3, 4}};

        assertEquals(2, ShortestDirectedRoute.minEdges(5, edges, 0, 4));
    }

    @Test
    void respectsEdgeDirectionWhenTargetIsUnreachable() {
        int[][] edges = {{1, 0}};

        assertEquals(-1, ShortestDirectedRoute.minEdges(2, edges, 0, 1));
    }

    @Test
    void handlesCyclesSelfLoopsAndParallelEdges() {
        int[][] edges = {{0, 0}, {0, 1}, {0, 1}, {1, 2}, {2, 0}, {2, 3}};

        assertEquals(3, ShortestDirectedRoute.minEdges(4, edges, 0, 3));
    }

    @Test
    void returnsZeroWhenSourceIsTarget() {
        int[][] edges = {{0, 1}, {1, 0}};

        assertEquals(0, ShortestDirectedRoute.minEdges(2, edges, 1, 1));
    }
}
