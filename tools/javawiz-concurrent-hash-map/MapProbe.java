import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.util.concurrent.ConcurrentHashMap;
import sun.misc.Unsafe;

/** Observation and scheduling only. No map field is written by this helper. */
public final class MapProbe {
    private static final Unsafe UNSAFE;
    private static final long TABLE;
    static {
        try {
            var field = Unsafe.class.getDeclaredField("theUnsafe");
            field.setAccessible(true);
            UNSAFE = (Unsafe) field.get(null);
            TABLE = UNSAFE.objectFieldOffset(ConcurrentHashMap.class.getDeclaredField("table"));
        } catch (ReflectiveOperationException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    public static Object[] table(ConcurrentHashMap<?, ?> map) {
        return (Object[]) UNSAFE.getObjectVolatile(map, TABLE);
    }

    public static void checkpoint(String id) { }

    public static void awaitBlocked(Thread thread, Object monitor) {
        long deadline = System.nanoTime() + 30_000_000_000L;
        while (System.nanoTime() < deadline) {
            ThreadInfo info = ManagementFactory.getThreadMXBean().getThreadInfo(thread.threadId());
            if (info != null && info.getThreadState() == Thread.State.BLOCKED
                    && info.getLockInfo() != null
                    && info.getLockInfo().getIdentityHashCode() == System.identityHashCode(monitor)) return;
            if (!thread.isAlive()) throw new AssertionError("Worker finished before checkpoint");
            try { Thread.sleep(1); } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new AssertionError(exception);
            }
        }
        throw new AssertionError("Worker did not reach the expected bucket monitor");
    }

    public static void join(Thread thread) {
        try { thread.join(30_000); } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError(exception);
        }
        if (thread.isAlive()) throw new AssertionError("Worker did not finish");
    }

    public static ConcurrentHashMap<MapKey, Integer> resizeMap() {
        var map = new ConcurrentHashMap<MapKey, Integer>(16);
        for (int hash = 0; hash < 20; hash++) map.put(new MapKey("K" + hash, hash), hash);
        map.put(new MapKey("K24", 24), 24);
        map.put(new MapKey("A", 31), 31);
        map.put(new MapKey("B", 63), 63);
        if (table(map).length != 32 || map.size() != 23) throw new AssertionError("Unexpected initial table");
        return map;
    }
}
