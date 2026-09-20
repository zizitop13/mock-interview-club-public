package club.mockinterview.pool;

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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(long orderId) {
        jdbc.update("insert into order_audit(order_id) values (?)", orderId);
    }
}
