---
id: concurrency-delivery-slots-virtual-thread-connection-leak
status: draft
---

## Question

A delivery planner queries SQL for available slots in many regions. Which smallest change gives this virtual-thread service safe JDBC resource ownership under load?

```java
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;

public final class DeliverySlotFinder implements AutoCloseable {
    private final DataSource database;
    private final ThreadLocal<Connection> connections;
    private final ExecutorService io =
            Executors.newVirtualThreadPerTaskExecutor();

    public DeliverySlotFinder(DataSource database) {
        this.database = database;
        this.connections = ThreadLocal.withInitial(this::openConnection);
    }

    public List<Integer> find(List<String> regions) throws Exception {
        List<Future<Integer>> tasks = regions.stream()
                .map(region -> io.submit(() -> available(region)))
                .toList();
        List<Integer> result = new ArrayList<>();
        for (Future<Integer> task : tasks) {
            result.add(task.get());
        }
        return result;
    }

    private int available(String region) throws SQLException {
        try (PreparedStatement statement = connections.get()
                .prepareStatement(
                        "SELECT available FROM delivery_slots WHERE region = ?")) {
            statement.setString(1, region);
            try (ResultSet rows = statement.executeQuery()) {
                return rows.next() ? rows.getInt(1) : 0;
            }
        }
    }

    private Connection openConnection() {
        try {
            return database.getConnection();
        } catch (SQLException failure) {
            throw new IllegalStateException(failure);
        }
    }

    @Override
    public void close() {
        io.close();
    }
}
```

## Answers

a. Replace the virtual-thread executor with a fixed pool so connections are reused.
b. Increase the JDBC pool size to match the peak number of virtual-thread tasks.
c. Call `connections.remove()` after each query without closing the stored connection.
d. Remove the `ThreadLocal`; acquire and close a connection inside each query.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

Each virtual thread initializes a pooled connection that is never closed. Acquire it inside the query and use try-with-resources so every borrow is returned deterministically.

</details>
