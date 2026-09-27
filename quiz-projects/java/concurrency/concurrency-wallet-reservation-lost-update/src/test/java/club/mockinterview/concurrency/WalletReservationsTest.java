package club.mockinterview.concurrency;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;

class WalletReservationsTest {
    @Test
    void separateCheckAndPutAllowReservationsBeyondAvailableFunds() throws Exception {
        CyclicBarrier bothBalancesRead = new CyclicBarrier(2);
        WalletReservations wallets = new WalletReservations(() -> await(bothBalancesRead));
        wallets.open("wallet-7", 100);

        List<Boolean> results = callTogether(
                () -> wallets.reserveUnsafe("wallet-7", 60),
                () -> wallets.reserveUnsafe("wallet-7", 60));

        assertEquals(List.of(true, true), results);
        assertEquals(40, wallets.available("wallet-7"));
    }

    @Test
    void computeProtectsTheReservationInvariantPerWallet() throws Exception {
        WalletReservations wallets = new WalletReservations();
        wallets.open("wallet-7", 100);

        List<Boolean> results = callTogether(
                () -> wallets.reserveAtomically("wallet-7", 60),
                () -> wallets.reserveAtomically("wallet-7", 60));

        assertEquals(1L, results.stream().filter(Boolean::booleanValue).count());
        assertTrue(results.contains(false));
        assertEquals(40, wallets.available("wallet-7"));
    }

    private static List<Boolean> callTogether(
            Callable<Boolean> first,
            Callable<Boolean> second) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> firstResult = pool.submit(first);
            Future<Boolean> secondResult = pool.submit(second);
            return List.of(firstResult.get(2, SECONDS), secondResult.get(2, SECONDS));
        } finally {
            pool.shutdownNow();
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(2, SECONDS);
        } catch (Exception failure) {
            throw new IllegalStateException("concurrent test did not reach its barrier", failure);
        }
    }
}
