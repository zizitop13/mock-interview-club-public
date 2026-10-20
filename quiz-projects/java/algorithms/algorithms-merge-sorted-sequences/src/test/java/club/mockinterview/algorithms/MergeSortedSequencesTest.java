package club.mockinterview.algorithms;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

import org.junit.jupiter.api.Test;

class MergeSortedSequencesTest {
    @Test
    void mergesTheWorkedExample() {
        int[][] sequences = {{1, 4, 4}, {1, 3}, {2, 6}};

        assertArrayEquals(
                new int[] {1, 1, 2, 3, 4, 4, 6},
                MergeSortedSequences.merge(sequences));
    }

    @Test
    void preservesDuplicatesAndIgnoresEmptySequences() {
        int[][] sequences = {{}, {2, 2, 2}, {}, {2, 2}};

        assertArrayEquals(
                new int[] {2, 2, 2, 2, 2},
                MergeSortedSequences.merge(sequences));
    }

    @Test
    void handlesNegativeValuesAndUnevenSequenceLengths() {
        int[][] sequences = {{-10, -1, 7, 9}, {-8}, {-8, 0, 12}};

        assertArrayEquals(
                new int[] {-10, -8, -8, -1, 0, 7, 9, 12},
                MergeSortedSequences.merge(sequences));
    }

    @Test
    void returnsEmptyOutputWhenEverySequenceIsEmpty() {
        assertArrayEquals(
                new int[0],
                MergeSortedSequences.merge(new int[][] {{}, {}, {}}));
    }
}
