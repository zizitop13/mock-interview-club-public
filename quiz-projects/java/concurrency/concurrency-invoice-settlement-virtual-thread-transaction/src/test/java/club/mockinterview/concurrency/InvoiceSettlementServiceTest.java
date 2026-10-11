package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.Connection;
import java.sql.Statement;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;

class InvoiceSettlementServiceTest {
    private static final AtomicInteger DATABASES = new AtomicInteger();

    @Test
    void virtualTasksCommitOutsideTheUnusedTransaction() throws Exception {
        DataSource database = databaseWithAccountButNoInvoice();
        try (InvoiceSettlementService service =
                     new InvoiceSettlementService(database)) {
            assertThrows(IllegalStateException.class,
                    () -> service.settleAsync(404, 7, 100));

            assertEquals(900, service.balance(7));
        }
    }

    @Test
    void oneConnectionRollsBackBothBusinessUpdates() throws Exception {
        DataSource database = databaseWithAccountButNoInvoice();
        try (InvoiceSettlementService service =
                     new InvoiceSettlementService(database)) {
            assertThrows(IllegalStateException.class,
                    () -> service.settleAtomically(404, 7, 100));

            assertEquals(1_000, service.balance(7));
        }
    }

    private static DataSource databaseWithAccountButNoInvoice()
            throws Exception {
        JdbcDataSource database = new JdbcDataSource();
        database.setURL("jdbc:h2:mem:invoice_"
                + DATABASES.incrementAndGet()
                + ";DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=2000");
        try (Connection connection = database.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE accounts (
                        id BIGINT PRIMARY KEY,
                        balance BIGINT NOT NULL
                    )
                    """);
            statement.execute("""
                    CREATE TABLE invoices (
                        id BIGINT PRIMARY KEY,
                        paid INT NOT NULL
                    )
                    """);
            statement.execute("""
                    INSERT INTO accounts (id, balance)
                    VALUES (7, 1000)
                    """);
        }
        return database;
    }
}
