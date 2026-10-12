package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.PrintWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Logger;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;

class DeliverySlotFinderTest {
    private static final int REGION_COUNT = 24;

    @Test
    void threadLocalLeavesOneBorrowedConnectionPerCompletedTask()
            throws Exception {
        CountingDataSource database = database("leaking");

        try (DeliverySlotFinder finder = new DeliverySlotFinder(database)) {
            assertEquals(expectedAvailability(), finder.find(regions()));
        }

        assertEquals(REGION_COUNT, database.borrowed());
        assertEquals(REGION_COUNT, database.open());
    }

    @Test
    void perQueryScopeReturnsEveryConnectionAfterCompletedTasks()
            throws Exception {
        CountingDataSource database = database("fixed");

        try (DeliverySlotFinder finder =
                     DeliverySlotFinder.withPerQueryConnections(database)) {
            assertEquals(expectedAvailability(), finder.find(regions()));
        }

        assertEquals(REGION_COUNT, database.borrowed());
        assertEquals(0, database.open());
    }

    private static CountingDataSource database(String name) throws SQLException {
        JdbcDataSource h2 = new JdbcDataSource();
        h2.setURL("jdbc:h2:mem:" + name + ";DB_CLOSE_DELAY=-1");
        try (Connection connection = h2.getConnection()) {
            connection.createStatement().execute("""
                    CREATE TABLE delivery_slots (
                        region VARCHAR(30) PRIMARY KEY,
                        available INTEGER NOT NULL
                    )
                    """);
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO delivery_slots(region, available) VALUES (?, ?)")) {
                for (int index = 0; index < REGION_COUNT; index++) {
                    insert.setString(1, "region-" + index);
                    insert.setInt(2, index + 1);
                    insert.addBatch();
                }
                insert.executeBatch();
            }
        }
        return new CountingDataSource(h2);
    }

    private static List<String> regions() {
        return java.util.stream.IntStream.range(0, REGION_COUNT)
                .mapToObj(index -> "region-" + index)
                .toList();
    }

    private static List<Integer> expectedAvailability() {
        return java.util.stream.IntStream.rangeClosed(1, REGION_COUNT)
                .boxed()
                .toList();
    }

    private static final class CountingDataSource implements DataSource {
        private final DataSource delegate;
        private final AtomicInteger borrowed = new AtomicInteger();
        private final AtomicInteger open = new AtomicInteger();

        private CountingDataSource(DataSource delegate) {
            this.delegate = delegate;
        }

        int borrowed() {
            return borrowed.get();
        }

        int open() {
            return open.get();
        }

        @Override
        public Connection getConnection() throws SQLException {
            return tracked(delegate.getConnection());
        }

        @Override
        public Connection getConnection(String username, String password)
                throws SQLException {
            return tracked(delegate.getConnection(username, password));
        }

        private Connection tracked(Connection connection) {
            borrowed.incrementAndGet();
            open.incrementAndGet();
            AtomicBoolean closed = new AtomicBoolean();
            return (Connection) Proxy.newProxyInstance(
                    Connection.class.getClassLoader(),
                    new Class<?>[]{Connection.class},
                    (proxy, method, arguments) -> {
                        if (method.getName().equals("close")) {
                            if (closed.compareAndSet(false, true)) {
                                try {
                                    return method.invoke(connection, arguments);
                                } finally {
                                    open.decrementAndGet();
                                }
                            }
                            return null;
                        }
                        try {
                            return method.invoke(connection, arguments);
                        } catch (InvocationTargetException failure) {
                            throw failure.getCause();
                        }
                    });
        }

        @Override
        public PrintWriter getLogWriter() throws SQLException {
            return delegate.getLogWriter();
        }

        @Override
        public void setLogWriter(PrintWriter writer) throws SQLException {
            delegate.setLogWriter(writer);
        }

        @Override
        public void setLoginTimeout(int seconds) throws SQLException {
            delegate.setLoginTimeout(seconds);
        }

        @Override
        public int getLoginTimeout() throws SQLException {
            return delegate.getLoginTimeout();
        }

        @Override
        public Logger getParentLogger() throws SQLFeatureNotSupportedException {
            return delegate.getParentLogger();
        }

        @Override
        public <T> T unwrap(Class<T> type) throws SQLException {
            return delegate.unwrap(type);
        }

        @Override
        public boolean isWrapperFor(Class<?> type) throws SQLException {
            return delegate.isWrapperFor(type);
        }
    }
}
