package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CallerRunsBackpressureTest {
    private final CallerRunsBackpressure sut = new CallerRunsBackpressure();

    @Test
    void callerRunsPolicyExecutesOverflowOnSubmittingThread() throws Exception {
        assertTrue(sut.overflowRunsOnSubmittingThread());
    }

    @Test
    void abortPolicyReportsOverflowWithoutRunningItInline() throws Exception {
        assertTrue(sut.explicitRejectionKeepsWorkOffSubmittingThread());
    }
}
