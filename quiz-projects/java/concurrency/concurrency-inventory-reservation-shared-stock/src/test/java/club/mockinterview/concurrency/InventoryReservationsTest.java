package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import javax.sql.DataSource;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;

class InventoryReservationsTest {
    private static final AtomicInteger DATABASES = new AtomicInteger();

    @Test
    void separateTransactionsLetTwoReplicasReserveTheLastUnit() throws Exception {
        DataSource database = databaseWithOneUnit();
        CyclicBarrier bothRead = new CyclicBarrier(2);
        InventoryReservations first =
                new InventoryReservations(database, () -> await(bothRead));
        InventoryReservations second =
                new InventoryReservations(database, () -> await(bothRead));

        List<Boolean> results = callTogether(
                () -> first.reserveUnsafe("sku-7", 1),
                () -> second.reserveUnsafe("sku-7", 1));

        assertEquals(List.of(true, true), results);
        assertEquals(0, first.available("sku-7"));
    }

    @Test
    void conditionalUpdateLetsOnlyOneReplicaReserveTheLastUnit() throws Exception {
        DataSource database = databaseWithOneUnit();
        CyclicBarrier startTogether = new CyclicBarrier(2);
        InventoryReservations first = new InventoryReservations(database);
        InventoryReservations second = new InventoryReservations(database);

        List<Boolean> results = callTogether(
                () -> {
                    await(startTogether);
                    return first.reserveAtomically("sku-7", 1);
                },
                () -> {
                    await(startTogether);
                    return second.reserveAtomically("sku-7", 1);
                });

        assertEquals(1L, results.stream().filter(Boolean::booleanValue).count());
        assertTrue(results.contains(false));
        assertEquals(0, first.available("sku-7"));
    }

    private static DataSource databaseWithOneUnit() throws Exception {
        JdbcDataSource database = new JdbcDataSource();
        database.setURL("jdbc:h2:mem:inventory_" + DATABASES.incrementAndGet()
                + ";DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=2000");
        try (Connection connection = database.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE inventory_stock (
                        sku VARCHAR(64) PRIMARY KEY,
                        available INT NOT NULL CHECK (available >= 0)
                    )
                    """);
            statement.execute("""
                    INSERT INTO inventory_stock (sku, available)
                    VALUES ('sku-7', 1)
                    """);
        }
        return database;
    }

    private static List<Boolean> callTogether(
            Callable<Boolean> first,
            Callable<Boolean> second) throws Exception {
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> firstResult = workers.submit(first);
            Future<Boolean> secondResult = workers.submit(second);
            return List.of(firstResult.get(2, SECONDS), secondResult.get(2, SECONDS));
        } finally {
            workers.shutdownNow();
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(2, SECONDS);
        } catch (Exception failure) {
            throw new IllegalStateException("concurrent test did not reach its barrier", failure);
        }
    }
}
