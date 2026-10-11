---
id: concurrency-invoice-settlement-virtual-thread-transaction
status: published
---

## Question

An authorized invoice settlement debits an account and marks the invoice paid. Both statements complete normally, but either may affect zero rows; which smallest change keeps the updates atomic while retaining scalable blocking I/O?

```java
import java.sql.*;
import java.util.concurrent.*;
import javax.sql.DataSource;

public final class InvoiceSettlementService implements AutoCloseable {
    private final DataSource database;
    private final ExecutorService io =
            Executors.newVirtualThreadPerTaskExecutor();

    public InvoiceSettlementService(DataSource database) {
        this.database = database;
    }

    public void settle(long invoiceId, long accountId, long cents)
            throws Exception {
        try (Connection tx = database.getConnection()) {
            tx.setAutoCommit(false);

            Future<Integer> debit = io.submit(() -> update(
                    "UPDATE accounts SET balance = balance - ? WHERE id = ?",
                    cents, accountId));
            Future<Integer> paid = io.submit(() -> update(
                    "UPDATE invoices SET paid = ? WHERE id = ?",
                    1, invoiceId));

            if (debit.get() != 1 || paid.get() != 1) {
                tx.rollback();
                throw new IllegalStateException("settlement failed");
            }
            tx.commit();
        }
    }

    private int update(String sql, long value, long id)
            throws SQLException {
        try (Connection connection = database.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, value);
            statement.setLong(2, id);
            return statement.executeUpdate();
        }
    }

    @Override
    public void close() {
        io.close();
    }
}
```

## Answers

a. Share `tx` across both virtual-thread tasks and execute the statements concurrently.
b. Run both updates sequentially on `tx`; invoke the whole method on a virtual thread.
c. Keep new connections per task, but roll back `tx` if either future returns zero.
d. Replace the virtual-thread executor with a fixed pool and keep both update helpers.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

The futures use auto-commit connections, so `tx` governs neither update. Use one connection for both statements; a virtual thread may block around the whole transaction.

</details>
