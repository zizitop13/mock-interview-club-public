package club.mockinterview.algorithms;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class MinimumShippingCapacityTest {
    @Test
    void findsTheMinimumCapacityInTheWorkedExample() {
        long[] weights = {3, 2, 2, 4, 1, 4};

        assertEquals(6, MinimumShippingCapacity.minimum(weights, 3));
    }

    @Test
    void usesTheTotalWeightWhenOnlyOneDayIsAllowed() {
        long[] weights = {3, 2, 2, 4, 1, 4};

        assertEquals(16, MinimumShippingCapacity.minimum(weights, 1));
    }

    @Test
    void usesTheHeaviestPackageWhenEveryPackageCanHaveItsOwnDay() {
        long[] weights = {3, 2, 2, 4, 1, 4};

        assertEquals(4, MinimumShippingCapacity.minimum(weights, weights.length));
    }

    @Test
    void preservesPackageOrderInsteadOfBalancingSortedWeights() {
        long[] weights = {6, 5, 4, 3};

        assertEquals(11, MinimumShippingCapacity.minimum(weights, 2));
    }

    @Test
    void usesLongForCapacitiesBeyondIntegerRange() {
        long[] weights = {1_000_000_000L, 1_000_000_000L, 1_000_000_000L};

        assertEquals(2_000_000_000L, MinimumShippingCapacity.minimum(weights, 2));
    }
}
