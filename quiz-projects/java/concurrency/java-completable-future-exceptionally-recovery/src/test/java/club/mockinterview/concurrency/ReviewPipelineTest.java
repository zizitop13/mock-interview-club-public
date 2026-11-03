package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletionException;

import org.junit.jupiter.api.Test;

class ReviewPipelineTest {
    private final ReviewPipeline pipeline = new ReviewPipeline();

    @Test
    void recoveryConvertsRiskFailureIntoPublishedApproval() {
        List<ReviewPipeline.Decision> reserved = new ArrayList<>();
        List<ReviewPipeline.Decision> published = new ArrayList<>();

        pipeline.broken(
                        ReviewPipeline.failedRiskCheck(),
                        score -> ReviewPipeline.Decision.approved("score " + score),
                        reserved::add,
                        published::add)
                .toCompletableFuture()
                .join();

        assertEquals(List.of(ReviewPipeline.Decision.approved("fallback")), reserved);
        assertEquals(reserved, published);
    }

    @Test
    void observationPreservesFailureAndSkipsSuccessOnlyStages() {
        List<Throwable> alerts = new ArrayList<>();
        List<ReviewPipeline.Decision> reserved = new ArrayList<>();
        List<ReviewPipeline.Decision> published = new ArrayList<>();

        assertThrows(
                CompletionException.class,
                () -> pipeline.fixed(
                                ReviewPipeline.failedRiskCheck(),
                                score -> ReviewPipeline.Decision.approved("score " + score),
                                alerts::add,
                                reserved::add,
                                published::add)
                        .toCompletableFuture()
                        .join());

        assertEquals(1, alerts.size());
        assertTrue(reserved.isEmpty());
        assertTrue(published.isEmpty());
    }
}
