package club.mockinterview.observability;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;

class FleetPercentilesTest {
    private static final double P99 = 0.99;

    @Test
    void reproducesTheWrongResultFromAWeightedAverageOfPodPercentiles() {
        List<Long> podA = podA();
        List<Long> podB = Collections.nCopies(100, 20L);
        List<List<Long>> pods = List.of(podA, podB);

        assertEquals(10L, FleetPercentiles.nearestRank(podA, P99));
        assertEquals(20L, FleetPercentiles.nearestRank(podB, P99));

        double dashboardValue =
                FleetPercentiles.weightedAverageOfLocalPercentiles(pods, P99);
        long actualFleetP99 = FleetPercentiles.percentileAfterMerging(pods, P99);

        assertEquals(15.0, dashboardValue);
        assertEquals(20L, actualFleetP99);
        assertNotEquals(actualFleetP99, dashboardValue);
    }

    @Test
    void computesTheFleetPercentileAfterMergingObservations() {
        List<List<Long>> pods = List.of(
                podA(),
                Collections.nCopies(100, 20L));

        assertEquals(20L, FleetPercentiles.percentileAfterMerging(pods, P99));
    }

    private static List<Long> podA() {
        List<Long> samples = new ArrayList<>(Collections.nCopies(99, 10L));
        samples.add(1_000L);
        return samples;
    }
}
