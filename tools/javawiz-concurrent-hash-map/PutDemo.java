import java.util.concurrent.ConcurrentHashMap;

public class PutDemo {
    public static void main(String[] args) {
        var map = new ConcurrentHashMap<MapKey, Integer>(2);
        var a = new MapKey("A", 1);
        var b = new MapKey("B", 5);
        MapProbe.checkpoint("empty"); // @frame empty
        map.put(a, 10);
        MapProbe.checkpoint("cas"); // @frame cas
        map.put(b, 20);
        MapProbe.checkpoint("collision"); // @frame collision
        Integer previous = map.put(a, 11);
        MapProbe.checkpoint("replace"); // @frame replace
        if (previous != 10 || map.size() != 2 || map.get(a) != 11) throw new AssertionError();
    }
}
