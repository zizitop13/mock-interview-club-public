package club.mockinterview.algorithms;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

import org.junit.jupiter.api.Test;

class PrerequisiteOrderTest {
    @Test
    void ordersTheWorkedExample() {
        int[][] edges = {{0, 2}, {1, 2}, {1, 3}, {2, 4}, {3, 4}};

        assertArrayEquals(
                new int[] {0, 1, 2, 3, 4},
                PrerequisiteOrder.order(5, edges));
    }

    @Test
    void includesDisconnectedComponents() {
        int[][] edges = {{0, 1}, {2, 3}};

        assertArrayEquals(
                new int[] {0, 2, 1, 3},
                PrerequisiteOrder.order(4, edges));
    }

    @Test
    void countsParallelEdgesSeparately() {
        int[][] edges = {{0, 1}, {0, 1}, {1, 2}};

        assertArrayEquals(
                new int[] {0, 1, 2},
                PrerequisiteOrder.order(3, edges));
    }

    @Test
    void returnsEmptyWhenADirectedCycleRemains() {
        int[][] edges = {{0, 1}, {1, 2}, {2, 0}};

        assertArrayEquals(
                new int[0],
                PrerequisiteOrder.order(3, edges));
    }

    @Test
    void treatsASelfLoopAsACycle() {
        assertArrayEquals(
                new int[0],
                PrerequisiteOrder.order(1, new int[][] {{0, 0}}));
    }
}
