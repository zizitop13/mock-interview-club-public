package club.mockinterview.transactions;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class OrderService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;

    OrderService(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @Transactional
    public void placeCatchingRequiredFailure(long orderId) {
        insertOrder(orderId);
        try {
            audit.recordRequiredAndFail(orderId);
        } catch (IllegalStateException ignored) {
            // The shared transaction is still rollback-only.
        }
    }

    @Transactional
    public void placeWithIsolatedAuditFailure(long orderId) {
        insertOrder(orderId);
        try {
            audit.recordInNewTransactionAndFail(orderId);
        } catch (IllegalStateException ignored) {
            // The failed inner transaction is independent of this transaction.
        }
    }

    private void insertOrder(long orderId) {
        jdbc.update("insert into customer_orders(id) values (?)", orderId);
    }
}
