package club.mockinterview.concurrency;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.sql.DataSource;

public final class DeliverySlotFinder implements AutoCloseable {
    private final DataSource database;
    private final ThreadLocal<Connection> connections;
    private final boolean perQueryConnections;
    private final ExecutorService io =
            Executors.newVirtualThreadPerTaskExecutor();

    public DeliverySlotFinder(DataSource database) {
        this(database, false);
    }

    private DeliverySlotFinder(DataSource database, boolean perQueryConnections) {
        this.database = Objects.requireNonNull(database);
        this.perQueryConnections = perQueryConnections;
        this.connections = ThreadLocal.withInitial(this::openConnection);
    }

    public static DeliverySlotFinder withPerQueryConnections(
            DataSource database) {
        return new DeliverySlotFinder(database, true);
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
        if (perQueryConnections) {
            try (Connection connection = database.getConnection()) {
                return query(connection, region);
            }
        }
        return query(connections.get(), region);
    }

    private int query(Connection connection, String region)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
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
