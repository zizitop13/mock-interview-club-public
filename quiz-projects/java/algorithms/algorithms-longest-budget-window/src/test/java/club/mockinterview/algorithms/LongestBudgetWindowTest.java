package club.mockinterview.algorithms;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class LongestBudgetWindowTest {
    @Test
    void findsTheWorkedExample() {
        assertEquals(3, LongestBudgetWindow.longest(
                new int[] {2, 1, 3, 1, 1}, 5));
    }

    @Test
    void keepsConsecutiveZerosWhenTheBudgetIsZero() {
        assertEquals(2, LongestBudgetWindow.longest(
                new int[] {0, 0, 1, 0}, 0));
    }

    @Test
    void accumulatesUsingLongArithmetic() {
        assertEquals(2, LongestBudgetWindow.longest(
                new int[] {1_500_000_000, 1_500_000_000, 1},
                3_000_000_000L));
    }
}
