package club.mockinterview.transactions;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.UnexpectedRollbackException;

class CaughtInnerRollbackOnlyTest {
    @Test
    void reproducesUnexpectedRollbackAfterCatchingARequiredFailure() {
        try (Scenario scenario = new Scenario()) {
            assertThrows(UnexpectedRollbackException.class,
                    () -> scenario.orders.placeCatchingRequiredFailure(1L));

            assertEquals(0, scenario.orderRows());
            assertEquals(0, scenario.auditRows());
        }
    }

    @Test
    void isolatingBestEffortWorkLetsTheOuterTransactionCommit() {
        try (Scenario scenario = new Scenario()) {
            assertDoesNotThrow(() -> scenario.orders.placeWithIsolatedAuditFailure(2L));

            assertEquals(1, scenario.orderRows());
            assertEquals(0, scenario.auditRows());
        }
    }

    private static final class Scenario implements AutoCloseable {
        private final ConfigurableApplicationContext context;
        private final JdbcTemplate jdbc;
        private final OrderService orders;

        private Scenario() {
            context = new SpringApplicationBuilder(QuizApplication.class)
                    .web(WebApplicationType.NONE)
                    .properties("spring.datasource.url=jdbc:h2:mem:" + UUID.randomUUID()
                            + ";DB_CLOSE_DELAY=-1")
                    .run();
            jdbc = context.getBean(JdbcTemplate.class);
            orders = context.getBean(OrderService.class);
        }

        private int orderRows() {
            return jdbc.queryForObject("select count(*) from customer_orders", Integer.class);
        }

        private int auditRows() {
            return jdbc.queryForObject("select count(*) from audit_events", Integer.class);
        }

        @Override
        public void close() {
            context.close();
        }
    }
}
