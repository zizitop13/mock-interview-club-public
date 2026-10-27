import java.util.concurrent.ConcurrentHashMap;

public class ResizeDemo {
    public static void main(String[] args) {
        ConcurrentHashMap<MapKey, Integer> map = MapProbe.resizeMap();
        Object[] oldTable = MapProbe.table(map);
        Object low = oldTable[0];
        Object middle = oldTable[24];
        Object high = oldTable[31];
        Thread writer = new Thread(() -> map.put(new MapKey("Trigger", 23), 23), "resize-initiator");
        Thread helper = new Thread(() -> map.put(new MapKey("A", 31), 310), "resize-helper");
        MapProbe.checkpoint("ready"); // @frame ready
        synchronized (low) {
            synchronized (middle) {
                synchronized (high) {
                    writer.start();
                    MapProbe.awaitBlocked(writer, high);
                    MapProbe.checkpoint("allocated"); // @frame allocated
                }
                MapProbe.awaitBlocked(writer, middle);
                MapProbe.checkpoint("split"); // @frame split
                Integer forwardedValue = map.get(new MapKey("B", 63));
                MapProbe.checkpoint("forwarded-get"); // @frame forwarded-get
                helper.start();
                MapProbe.awaitBlocked(helper, low);
                MapProbe.checkpoint("helping"); // @frame helping
            }
            MapProbe.join(writer);
            MapProbe.checkpoint("almost-done"); // @frame almost-done
        }
        MapProbe.join(helper);
        MapProbe.checkpoint("complete"); // @frame complete
        if (map.size() != 24 || MapProbe.table(map).length != 64
                || map.get(new MapKey("A", 31)) != 310) throw new AssertionError();
    }
}
