---
id: concurrency-inventory-reservation-shared-stock
status: draft
---

## Question

Two service replicas reserve units from the same warehouse stock database. Which smallest change prevents successful reservations from exceeding available units?

```java
import java.sql.*;
import javax.sql.DataSource;

public final class InventoryReservations {
    private final DataSource database;

    public InventoryReservations(DataSource database) {
        this.database = database;
    }

    // Connections use auto-commit, and stock rows are not deleted.
    public boolean reserve(String sku, int units) throws SQLException {
        if (units <= 0) throw new IllegalArgumentException();

        int available = readAvailable(sku);
        if (available < units) return false;

        try (Connection c = database.getConnection();
             PreparedStatement update = c.prepareStatement(
                 "UPDATE inventory_stock SET available = ? WHERE sku = ?")) {
            update.setInt(1, available - units);
            update.setString(2, sku);
            return update.executeUpdate() == 1;
        }
    }

    private int readAvailable(String sku) throws SQLException {
        try (Connection c = database.getConnection();
             PreparedStatement query = c.prepareStatement(
                 "SELECT available FROM inventory_stock WHERE sku = ?")) {
            query.setString(1, sku);
            try (ResultSet rows = query.executeQuery()) {
                return rows.next() ? rows.getInt(1) : 0;
            }
        }
    }
}
```

## Answers

a. Synchronize `reserve` in each JVM, keeping the separate `SELECT` and `UPDATE`.
b. Raise isolation for each existing one-statement auto-commit transaction.
c. Use one conditional `UPDATE` that decrements only when `available >= units`.
d. Add `FOR UPDATE` to `SELECT`, but close that connection before running `UPDATE`.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

Both replicas can read the same stock before either update, so both return success. One conditional database update makes the check and decrement atomic across JVMs.

</details>
