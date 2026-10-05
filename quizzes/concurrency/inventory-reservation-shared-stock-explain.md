# Keeping inventory reservations within shared stock

## Correct answer

c. Use one conditional `UPDATE` that decrements only when `available >= units`.

## Detailed explanation

The business invariant is: for each SKU, the total units reported as successfully reserved must never exceed the stock available in the shared database.

The code performs the decision and the state change in separate auto-commit transactions. If one unit remains, replica A and replica B can both read `available = 1`. Each then writes `available = 0`, and both return `true`. The stored value never becomes negative, but the service has promised the same unit to two callers.

A Java monitor cannot protect this invariant across service replicas because each JVM owns a different monitor. The correctness boundary must be the shared database. A single conditional update asks the database to check the predicate and decrement the row as one statement. Under concurrent execution, only one statement can update the last unit; the other observes that its predicate no longer matches and returns an update count of zero.

This solution assumes stock rows are not deleted during reservation, as stated in the code. The update count is therefore an unambiguous reservation result: one row means success and zero rows means missing or insufficient stock.

## Code example

```java
public boolean reserve(String sku, int units) throws SQLException {
    if (units <= 0) throw new IllegalArgumentException();

    try (Connection c = database.getConnection();
         PreparedStatement update = c.prepareStatement("""
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
```

The runnable proof starts two independent service objects against one H2 database containing one unit. The reproduction test coordinates both reads before either write and verifies that both unsafe calls succeed. The fix test runs two conditional updates concurrently and verifies that exactly one succeeds.

## Why the other options are incorrect

- a. `synchronized` coordinates callers only inside one service replica; the other JVM can still reserve concurrently.
- b. Raising isolation separately does not combine the `SELECT` and later `UPDATE` into one transaction or atomic decision.
- d. `FOR UPDATE` loses its row lock when the read connection's auto-commit transaction ends, before the update begins.
