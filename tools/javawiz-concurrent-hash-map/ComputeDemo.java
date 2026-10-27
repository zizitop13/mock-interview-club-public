import java.util.concurrent.ConcurrentHashMap;

public class ComputeDemo {
    public static void main(String[] args) {
        var map = new ConcurrentHashMap<MapKey, Integer>(2);
        var a = new MapKey("A", 1);
        MapProbe.checkpoint("empty"); // @frame empty
        Integer inserted = map.compute(a, (key, oldValue) -> {
            MapProbe.checkpoint("reservation"); // @frame reservation
            return 10;
        });
        MapProbe.checkpoint("inserted"); // @frame inserted
        Integer updated = map.compute(a, (key, oldValue) -> {
            MapProbe.checkpoint("remapping"); // @frame remapping
            return oldValue + 5;
        });
        MapProbe.checkpoint("updated"); // @frame updated
        Integer removed = map.compute(a, (key, oldValue) -> null);
        MapProbe.checkpoint("removed"); // @frame removed
        if (inserted != 10 || updated != 15 || removed != null || !map.isEmpty()) throw new AssertionError();
    }
}
