package club.mockinterview.algorithms;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

import org.junit.jupiter.api.Test;

class NextWarmerDistanceTest {
    @Test
    void findsNearestWarmerDistancesInWorkedExample() {
        assertArrayEquals(
                new int[] {1, 2, 1, 0},
                NextWarmerDistance.distances(new int[] {73, 74, 71, 75}));
    }

    @Test
    void treatsEqualTemperaturesAsUnresolved() {
        assertArrayEquals(
                new int[] {2, 1, 0},
                NextWarmerDistance.distances(new int[] {70, 70, 71}));
    }

    @Test
    void leavesZeroWhenNoLaterTemperatureIsWarmer() {
        assertArrayEquals(
                new int[] {0, 0, 0},
                NextWarmerDistance.distances(new int[] {80, 79, 78}));
    }
}
