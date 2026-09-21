package club.mockinterview.observability;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Executor;

import org.slf4j.MDC;

public final class MdcPropagatingExecutor implements Executor {
    private final Executor delegate;

    public MdcPropagatingExecutor(Executor delegate) {
        this.delegate = Objects.requireNonNull(delegate);
    }

    @Override
    public void execute(Runnable command) {
        Map<String, String> captured = MDC.getCopyOfContextMap();

        delegate.execute(() -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            try {
                replaceContext(captured);
                command.run();
            } finally {
                replaceContext(previous);
            }
        });
    }

    private static void replaceContext(Map<String, String> context) {
        if (context == null) {
            MDC.clear();
        } else {
            MDC.setContextMap(context);
        }
    }
}
