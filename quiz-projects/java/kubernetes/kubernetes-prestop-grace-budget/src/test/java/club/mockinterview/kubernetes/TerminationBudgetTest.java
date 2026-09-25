package club.mockinterview.kubernetes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

class TerminationBudgetTest {
    @Test
    void reproducesPreStopConsumingThePodGracePeriod() throws IOException {
        TerminationBudget budget = loadBudget("problematic-pod.yaml");

        assertEquals(Duration.ofSeconds(15), budget.timeRemainingAfterSigterm());
        assertFalse(budget.allowsGracefulApplicationShutdown());
    }

    @Test
    void largerPodBudgetLeavesTimeForSpringAndMargin() throws IOException {
        TerminationBudget budget = loadBudget("fixed-pod.yaml");

        assertEquals(Duration.ofSeconds(30), budget.timeRemainingAfterSigterm());
        assertTrue(budget.allowsGracefulApplicationShutdown());
    }

    private static TerminationBudget loadBudget(String resource) throws IOException {
        try (InputStream input = TerminationBudgetTest.class.getResourceAsStream("/" + resource)) {
            if (input == null) {
                throw new IOException("missing test resource " + resource);
            }

            Map<String, Object> pod = new Yaml().load(input);
            Map<String, Object> spec = map(pod.get("spec"));
            Map<String, Object> container = map(list(spec.get("containers")).getFirst());
            Map<String, Object> lifecycle = map(container.get("lifecycle"));
            Map<String, Object> preStop = map(lifecycle.get("preStop"));
            Map<String, Object> exec = map(preStop.get("exec"));
            List<Object> command = list(exec.get("command"));
            Map<String, Object> shutdownTimeout = list(container.get("env")).stream()
                    .map(TerminationBudgetTest::map)
                    .filter(entry -> "SPRING_LIFECYCLE_TIMEOUT_PER_SHUTDOWN_PHASE".equals(entry.get("name")))
                    .findFirst()
                    .orElseThrow();

            long podSeconds = ((Number) spec.get("terminationGracePeriodSeconds")).longValue();
            long preStopSeconds = Long.parseLong(command.getLast().toString().replace("sleep ", ""));
            long springSeconds = Long.parseLong(shutdownTimeout.get("value").toString().replace("s", ""));

            return new TerminationBudget(
                    Duration.ofSeconds(podSeconds),
                    Duration.ofSeconds(preStopSeconds),
                    Duration.ofSeconds(springSeconds));
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> list(Object value) {
        return (List<Object>) value;
    }
}
