package club.mockinterview.transactions;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
class AuditService {
    private final JdbcTemplate jdbc;

    AuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public void recordRequiredAndFail(long orderId) {
        insertThenFail(orderId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordInNewTransactionAndFail(long orderId) {
        insertThenFail(orderId);
    }

    private void insertThenFail(long orderId) {
        jdbc.update("insert into audit_events(order_id) values (?)", orderId);
        throw new IllegalStateException("simulated audit failure");
    }
}
