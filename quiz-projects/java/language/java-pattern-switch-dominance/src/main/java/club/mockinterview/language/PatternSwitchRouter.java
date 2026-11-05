package club.mockinterview.language;

public final class PatternSwitchRouter {
    private PatternSwitchRouter() {}

    public enum Route { JSON, TEXT, EMPTY, OTHER }

    public static Route route(Object message) {
        return switch (message) {
            case String json when json.stripLeading().startsWith("{") -> Route.JSON;
            case CharSequence text -> Route.TEXT;
            case null -> Route.EMPTY;
            default -> Route.OTHER;
        };
    }
}
