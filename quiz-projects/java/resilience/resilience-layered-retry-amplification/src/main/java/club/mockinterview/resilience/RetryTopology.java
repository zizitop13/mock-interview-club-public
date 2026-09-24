package club.mockinterview.resilience;

public final class RetryTopology {
    private static final int MAX_ATTEMPTS = 3;

    private final Inventory inventory;

    public RetryTopology(Inventory inventory) {
        this.inventory = inventory;
    }

    public void callWithIndependentRetries() {
        retry(MAX_ATTEMPTS, () ->
                retry(MAX_ATTEMPTS, inventory::reserve));
    }

    public void callWithGatewayOwnedRetry() {
        retry(MAX_ATTEMPTS, inventory::reserve);
    }

    private static void retry(int maxAttempts, Runnable operation) {
        for (int attempt = 1; ; attempt++) {
            try {
                operation.run();
                return;
            } catch (ServiceUnavailableException failure) {
                if (attempt == maxAttempts) {
                    throw failure;
                }
            }
        }
    }

    @FunctionalInterface
    public interface Inventory {
        void reserve();
    }

    public static final class ServiceUnavailableException extends RuntimeException {
        public ServiceUnavailableException() {
            super("inventory returned 503");
        }
    }
}
