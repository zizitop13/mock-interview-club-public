package club.mockinterview.concurrency;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.sql.DataSource;

public final class InvoiceSettlementService implements AutoCloseable {
    private static final String DEBIT =
            "UPDATE accounts SET balance = balance - ? WHERE id = ?";
    private static final String MARK_PAID =
            "UPDATE invoices SET paid = ? WHERE id = ?";

    private final DataSource database;
    private final ExecutorService io =
            Executors.newVirtualThreadPerTaskExecutor();

    public InvoiceSettlementService(DataSource database) {
        this.database = Objects.requireNonNull(database);
    }

    public void settleAsync(long invoiceId, long accountId, long cents)
            throws Exception {
        try (Connection tx = database.getConnection()) {
            tx.setAutoCommit(false);

            Future<Integer> debit = io.submit(
                    () -> updateOnNewConnection(DEBIT, cents, accountId));
            Future<Integer> paid = io.submit(
                    () -> updateOnNewConnection(MARK_PAID, 1, invoiceId));

            if (debit.get() != 1 || paid.get() != 1) {
                tx.rollback();
                throw new IllegalStateException("settlement failed");
            }
            tx.commit();
        }
    }

    public void settleAtomically(long invoiceId, long accountId, long cents)
            throws SQLException {
        try (Connection tx = database.getConnection()) {
            tx.setAutoCommit(false);
            try {
                int debited = update(tx, DEBIT, cents, accountId);
                int paid = update(tx, MARK_PAID, 1, invoiceId);
                if (debited != 1 || paid != 1) {
                    throw new IllegalStateException("settlement failed");
                }
                tx.commit();
            } catch (SQLException | RuntimeException failure) {
                tx.rollback();
                throw failure;
            }
        }
    }

    private int updateOnNewConnection(String sql, long value, long id)
            throws SQLException {
        try (Connection connection = database.getConnection()) {
            return update(connection, sql, value, id);
        }
    }

    private static int update(
            Connection connection,
            String sql,
            long value,
            long id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, value);
            statement.setLong(2, id);
            return statement.executeUpdate();
        }
    }

    long balance(long accountId) throws SQLException {
        try (Connection connection = database.getConnection();
             PreparedStatement query = connection.prepareStatement(
                     "SELECT balance FROM accounts WHERE id = ?")) {
            query.setLong(1, accountId);
            try (var rows = query.executeQuery()) {
                if (!rows.next()) {
                    throw new IllegalArgumentException("unknown account");
                }
                return rows.getLong(1);
            }
        }
    }

    @Override
    public void close() {
        io.close();
    }
}
