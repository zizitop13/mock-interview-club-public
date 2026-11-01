package club.mockinterview.language;

import java.util.List;

public final class BatchKeys {
    private BatchKeys() {}

    public record MutableBatchKey(List<String> accountIds) {}

    public record StableBatchKey(List<String> accountIds) {
        public StableBatchKey {
            accountIds = List.copyOf(accountIds);
        }
    }
}
