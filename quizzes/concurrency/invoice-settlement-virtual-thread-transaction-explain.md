# Keeping a JDBC transaction intact on virtual threads

## Correct answer

b. Run both updates sequentially on `tx`; invoke the whole method on a virtual thread.

## Detailed explanation

The hidden problem is that a JDBC transaction belongs to one `Connection`, not to the method, caller thread, executor, or group of futures. Each `update` call opens a different connection. New JDBC connections start in auto-commit mode, so both statements commit independently while the explicitly created `tx` connection executes no SQL at all.

The business invariant is: debiting the account and marking the invoice paid must commit together, or neither change may commit. If the debit succeeds but the invoice update affects zero rows, `tx.rollback()` cannot undo the debit because that debit already committed on another connection.

Virtual threads remain a good fit for blocking JDBC. They make waiting for database I/O cheaper at the Java-thread layer, but they do not merge transactions or make a JDBC connection safe for concurrent use. Execute both statements sequentially on the same connection and transaction. If the service boundary should be asynchronous, submit the entire `settle` call to a virtual thread rather than splitting one transaction across tasks.

## Code example

```java
public void settle(long invoiceId, long accountId, long cents)
        throws SQLException {
    try (Connection tx = database.getConnection()) {
        tx.setAutoCommit(false);
        try {
            int debited = update(tx,
                    "UPDATE accounts SET balance = balance - ? WHERE id = ?",
                    cents, accountId);
            int paid = update(tx,
                    "UPDATE invoices SET paid = ? WHERE id = ?",
                    1, invoiceId);

            if (debited != 1 || paid != 1) {
                throw new IllegalStateException("settlement failed");
            }
            tx.commit();
        } catch (Exception failure) {
            tx.rollback();
            throw failure;
        }
    }
}

private int update(Connection connection, String sql, long value, long id)
        throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
        statement.setLong(1, value);
        statement.setLong(2, id);
        return statement.executeUpdate();
    }
}
```

## Why the other options are incorrect

- a. A JDBC connection is not assumed safe for concurrent statement execution, and parallelism adds no atomicity beyond the one connection.
- c. Rolling back the unused `tx` connection cannot undo statements already committed on the tasks' separate connections.
- d. Changing executor size changes scheduling, not transaction ownership; the two helper connections still commit independently.
