package club.mockinterview.pool;

import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class OrderService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final CyclicBarrier outerTransactionsReady;

    OrderService(JdbcTemplate jdbc, AuditService audit, CyclicBarrier outerTransactionsReady) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.outerTransactionsReady = outerTransactionsReady;
    }

    @Transactional
    public void place(long orderId) {
        jdbc.update("insert into orders(id) values (?)", orderId);

        try {
            outerTransactionsReady.await(10, TimeUnit.SECONDS);
        } catch (Exception exception) {
            throw new IllegalStateException("Outer transactions did not reach the barrier", exception);
        }

        audit.record(orderId);
    }
}
