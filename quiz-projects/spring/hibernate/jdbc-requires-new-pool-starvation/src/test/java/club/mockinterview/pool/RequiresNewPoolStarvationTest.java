package club.mockinterview.pool;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

class RequiresNewPoolStarvationTest {
    private static final int REQUESTS = 20;

    @Test
    void reproducesStarvationWhenEveryConnectionIsHeldByAnOuterTransaction() throws Exception {
        try (Scenario scenario = new Scenario(REQUESTS)) {
            List<Future<?>> calls = scenario.startCalls();

            assertTrue(scenario.waitUntil(() -> scenario.waitingForConnections() == REQUESTS));
            assertEquals(REQUESTS, scenario.activeConnections());
            assertFalse(calls.stream().anyMatch(Future::isDone));
        }
    }

    @Test
    void oneSpareConnectionLetsEveryInnerTransactionFinish() throws Exception {
        try (Scenario scenario = new Scenario(REQUESTS + 1)) {
            for (Future<?> call : scenario.startCalls()) {
                call.get(10, TimeUnit.SECONDS);
            }

            assertEquals(REQUESTS, scenario.auditRows());
        }
    }

    private static final class Scenario implements AutoCloseable {
        private final ConfigurableApplicationContext context;
        private final ExecutorService executor = Executors.newFixedThreadPool(REQUESTS);
        private final OrderService orders;
        private final HikariDataSource dataSource;

        private Scenario(int poolSize) {
            context = new SpringApplicationBuilder(QuizApplication.class)
                    .web(WebApplicationType.NONE)
                    .properties(
                            "quiz.concurrent-requests=" + REQUESTS,
                            "spring.datasource.url=jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1",
                            "spring.datasource.hikari.maximum-pool-size=" + poolSize,
                            "spring.datasource.hikari.connection-timeout=30000")
                    .run();
            orders = context.getBean(OrderService.class);
            dataSource = context.getBean(HikariDataSource.class);
        }

        private List<Future<?>> startCalls() {
            List<Future<?>> calls = new ArrayList<>(REQUESTS);

            for (long id = 0; id < REQUESTS; id++) {
                long orderId = id;
                calls.add(executor.submit(() -> orders.place(orderId)));
            }

            return calls;
        }

        private int activeConnections() {
            return dataSource.getHikariPoolMXBean().getActiveConnections();
        }

        private int waitingForConnections() {
            return dataSource.getHikariPoolMXBean().getThreadsAwaitingConnection();
        }

        private int auditRows() {
            return context.getBean(JdbcTemplate.class)
                    .queryForObject("select count(*) from order_audit", Integer.class);
        }

        private boolean waitUntil(BooleanSupplier condition) throws InterruptedException {
            long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();

            while (System.nanoTime() < deadline) {
                if (condition.getAsBoolean()) {
                    return true;
                }
                Thread.sleep(10);
            }

            return condition.getAsBoolean();
        }

        @Override
        public void close() throws InterruptedException {
            executor.shutdownNow();
            executor.awaitTermination(5, TimeUnit.SECONDS);
            context.close();
        }
    }
}
