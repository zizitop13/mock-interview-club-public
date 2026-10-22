package club.mockinterview.algorithms;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BipartiteGroupsTest {
    @Test
    void splitsTheWorkedExampleAcrossDisconnectedComponents() {
        int[][] edges = {{0, 1}, {1, 2}, {2, 3}, {3, 0}, {4, 5}};

        assertTrue(BipartiteGroups.canSplit(6, edges));
    }

    @Test
    void rejectsAnOddCycleInAComponentNotContainingVertexZero() {
        int[][] edges = {{0, 1}, {2, 3}, {3, 4}, {4, 2}};

        assertFalse(BipartiteGroups.canSplit(5, edges));
    }

    @Test
    void acceptsParallelEdgesBecauseTheyRepeatTheSameConstraint() {
        int[][] edges = {{0, 1}, {0, 1}};

        assertTrue(BipartiteGroups.canSplit(2, edges));
    }

    @Test
    void rejectsASelfLoop() {
        assertFalse(BipartiteGroups.canSplit(1, new int[][] {{0, 0}}));
    }

    @Test
    void acceptsIsolatedVertices() {
        assertTrue(BipartiteGroups.canSplit(4, new int[0][0]));
    }
}
