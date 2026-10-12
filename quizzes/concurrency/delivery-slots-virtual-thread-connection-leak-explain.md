# Returning JDBC connections from virtual-thread tasks

## Correct answer

d. Remove the `ThreadLocal`; acquire and close a connection inside each query.

## Detailed explanation

The hidden problem is the lifetime assigned to the JDBC `Connection`. A virtual-thread-per-task executor creates a new virtual thread for each submitted region query. On its first `connections.get()`, every task borrows another connection from the pool. The code closes the statement and result set, but it never closes the connection, so the pool does not get that connection back when the task finishes.

The business invariant is: every connection borrowed for a delivery-slot query must be returned to the pool when that query completes, whether it succeeds or fails. Thread identity is not the resource boundary. This matters especially for short-lived virtual threads, whose large potential task count is intentionally unrelated to the much smaller, bounded database capacity.

Acquire the connection in `available` and include it in the same try-with-resources scope as the statement and result set. With a pooled `DataSource`, `Connection.close()` normally returns the logical connection to the pool. Virtual threads can still block efficiently during JDBC calls, while the connection pool remains the database concurrency limit.

## Code example

```java
private int available(String region) throws SQLException {
    try (Connection connection = database.getConnection();
         PreparedStatement statement = connection.prepareStatement(
                 "SELECT available FROM delivery_slots WHERE region = ?")) {
        statement.setString(1, region);
        try (ResultSet rows = statement.executeQuery()) {
            return rows.next() ? rows.getInt(1) : 0;
        }
    }
}
```

This scope also handles exceptions correctly: Java closes the result set, statement, and connection in reverse order before the task completes.

## Why the other options are incorrect

- a. A fixed pool may cap the number of leaked connections and accidentally reuse thread-local state, but it makes worker lifetime the connection lifetime and sacrifices virtual-thread scalability instead of fixing ownership.
- b. A larger pool only delays exhaustion. The number of short-lived virtual-thread tasks can greatly exceed a safe database connection count, and every borrowed connection is still left unclosed.
- c. `ThreadLocal.remove()` discards the association but does not invoke `Connection.close()`. It can make the leaked wrapper unreachable without returning the underlying pooled resource deterministically.
