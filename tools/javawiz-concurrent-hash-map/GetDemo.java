import java.util.concurrent.ConcurrentHashMap;

public class GetDemo {
    public static void main(String[] args) {
        var map = new ConcurrentHashMap<MapKey, Integer>(2);
        var a = new MapKey("A", 1);
        var b = new MapKey("B", 5);
        map.put(a, 10);
        map.put(b, 20);
        MapProbe.checkpoint("ready"); // @frame ready
        Integer headValue = map.get(a);
        MapProbe.checkpoint("head"); // @frame head
        Integer chainedValue = map.get(b);
        MapProbe.checkpoint("chain"); // @frame chain
        Integer missingValue = map.get(new MapKey("Missing", 9));
        MapProbe.checkpoint("miss"); // @frame miss
        if (headValue != 10 || chainedValue != 20 || missingValue != null) throw new AssertionError();
    }
}
