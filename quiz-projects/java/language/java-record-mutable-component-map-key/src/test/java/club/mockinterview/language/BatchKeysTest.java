package club.mockinterview.language;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.junit.jupiter.api.Test;

class BatchKeysTest {
    private static final BigDecimal TOTAL = new BigDecimal("125.00");

    @Test
    void mutableRecordComponentChangesHashAfterInsertion() {
        List<String> accountIds = new ArrayList<>(List.of("A"));
        BatchKeys.MutableBatchKey key = new BatchKeys.MutableBatchKey(accountIds);
        ConcurrentMap<BatchKeys.MutableBatchKey, BigDecimal> totals = new ConcurrentHashMap<>();
        totals.put(key, TOTAL);

        accountIds.add("B");

        assertNull(totals.get(key));
        assertEquals(1, totals.size());
    }

    @Test
    void defensiveCopyKeepsHashStableAndAccessorUnmodifiable() {
        List<String> accountIds = new ArrayList<>(List.of("A"));
        BatchKeys.StableBatchKey key = new BatchKeys.StableBatchKey(accountIds);
        ConcurrentMap<BatchKeys.StableBatchKey, BigDecimal> totals = new ConcurrentHashMap<>();
        totals.put(key, TOTAL);

        accountIds.add("B");

        assertEquals(TOTAL, totals.get(key));
        assertEquals(List.of("A"), key.accountIds());
        assertThrows(UnsupportedOperationException.class, () -> key.accountIds().add("C"));
    }
}
