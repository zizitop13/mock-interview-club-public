package club.mockinterview.language;

public final class SwitchExpressionYield {
    private SwitchExpressionYield() {}

    public enum Zone {
        LOCAL,
        INTERNATIONAL
    }

    public record Parcel(Zone zone, int weightKg) {}

    public static int fixedShippingCost(Parcel parcel) {
        int base = switch (parcel.zone()) {
            case LOCAL -> 5;
            case INTERNATIONAL -> {
                if (parcel.weightKg() > 20) {
                    yield 40;
                }
                yield 20;
            }
        };

        return addFuelSurcharge(base);
    }

    private static int addFuelSurcharge(int base) {
        return base + base / 10;
    }
}
