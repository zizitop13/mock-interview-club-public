package club.mockinterview.concurrency;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import javax.sql.DataSource;

public final class InventoryReservations {
    private final DataSource database;
    private final Runnable afterUnsafeRead;

    public InventoryReservations(DataSource database) {
        this(database, () -> { });
    }

    InventoryReservations(DataSource database, Runnable afterUnsafeRead) {
        this.database = Objects.requireNonNull(database);
        this.afterUnsafeRead = Objects.requireNonNull(afterUnsafeRead);
    }

    public boolean reserveUnsafe(String sku, int units) throws SQLException {
        requirePositive(units);
        int available = readAvailable(sku);
        afterUnsafeRead.run();
        if (available < units) {
            return false;
        }

        try (Connection connection = database.getConnection();
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE inventory_stock SET available = ? WHERE sku = ?")) {
            update.setInt(1, available - units);
            update.setString(2, sku);
            return update.executeUpdate() == 1;
        }
    }

    public boolean reserveAtomically(String sku, int units) throws SQLException {
        requirePositive(units);
        try (Connection connection = database.getConnection();
             PreparedStatement update = connection.prepareStatement("""
                     UPDATE inventory_stock
                        SET available = available - ?
                      WHERE sku = ?
                        AND available >= ?
                     """)) {
            update.setInt(1, units);
            update.setString(2, sku);
            update.setInt(3, units);
            return update.executeUpdate() == 1;
        }
    }

    public int available(String sku) throws SQLException {
        return readAvailable(sku);
    }

    private int readAvailable(String sku) throws SQLException {
        Objects.requireNonNull(sku);
        try (Connection connection = database.getConnection();
             PreparedStatement query = connection.prepareStatement(
                     "SELECT available FROM inventory_stock WHERE sku = ?")) {
            query.setString(1, sku);
            try (ResultSet rows = query.executeQuery()) {
                return rows.next() ? rows.getInt(1) : 0;
            }
        }
    }

    private static void requirePositive(int units) {
        if (units <= 0) {
            throw new IllegalArgumentException("units must be positive");
        }
    }
}
