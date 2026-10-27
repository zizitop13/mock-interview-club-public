package club.mockinterview.language;

import static club.mockinterview.language.SwitchExpressionYield.Zone.INTERNATIONAL;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class SwitchExpressionYieldTest {
    private static final SwitchExpressionYield.Parcel HEAVY_INTERNATIONAL =
            new SwitchExpressionYield.Parcel(INTERNATIONAL, 25);

    @Test
    void returnAccidentallyLeavesTheEnclosingMethodBeforeTheSurcharge() {
        assertEquals(40, SwitchExpressionYield.brokenShippingCost(HEAVY_INTERNATIONAL));
    }

    @Test
    void yieldProducesTheSwitchValueAndContinuesTheMethod() {
        assertEquals(44, SwitchExpressionYield.fixedShippingCost(HEAVY_INTERNATIONAL));
    }
}
