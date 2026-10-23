package club.mockinterview.algorithms;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class WeightedShortestRouteTest {
    @Test
    void findsTheWorkedExampleRouteAfterImprovingAHeapEntry() {
        int[][] edges = {
            {0, 1, 4},
            {0, 2, 1},
            {2, 1, 2},
            {1, 3, 1},
            {2, 3, 7}
        };

        assertEquals(4, WeightedShortestRoute.shortestDistance(4, edges, 0, 3));
    }

    @Test
    void usesLongForDistancesBeyondIntegerRange() {
        int[][] edges = {{0, 1, 1_000_000_000}, {1, 2, 1_000_000_000}, {2, 3, 1_000_000_000}};

        assertEquals(3_000_000_000L, WeightedShortestRoute.shortestDistance(4, edges, 0, 3));
    }

    @Test
    void returnsMinusOneWhenTargetIsUnreachable() {
        assertEquals(-1, WeightedShortestRoute.shortestDistance(3, new int[][] {{0, 1, 5}}, 0, 2));
    }

    @Test
    void returnsZeroWhenSourceEqualsTarget() {
        assertEquals(0, WeightedShortestRoute.shortestDistance(2, new int[][] {{0, 1, 9}}, 1, 1));
    }

    @Test
    void handlesZeroWeightParallelEdgesAndCycles() {
        int[][] edges = {{0, 1, 8}, {0, 1, 0}, {1, 0, 0}, {1, 2, 2}};

        assertEquals(2, WeightedShortestRoute.shortestDistance(3, edges, 0, 2));
    }
}
