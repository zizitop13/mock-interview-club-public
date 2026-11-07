package club.mockinterview.concurrency;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Phaser;
import java.util.function.Consumer;

public final class PhaserBatch {
    public record Job(boolean valid) {}

    public record Result(boolean phaseCompleted, int registeredParties) {}

    public Result broken(List<Job> jobs, Consumer<Job> processor) throws Exception {
        Phaser phaser = new Phaser(1);
        List<Future<?>> tasks = new ArrayList<>();

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (Job job : jobs) {
                phaser.register();
                tasks.add(executor.submit(() -> {
                    if (!job.valid()) {
                        return;
                    }
                    processor.accept(job);
                    phaser.arriveAndDeregister();
                }));
            }
            await(tasks);
        }

        phaser.arriveAndDeregister();
        return new Result(phaser.isTerminated(), phaser.getRegisteredParties());
    }

    public Result fixed(List<Job> jobs, Consumer<Job> processor) throws Exception {
        Phaser phaser = new Phaser(1);
        List<Future<?>> tasks = new ArrayList<>();

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (Job job : jobs) {
                phaser.register();
                try {
                    tasks.add(executor.submit(() -> {
                        try {
                            if (job.valid()) {
                                processor.accept(job);
                            }
                        } finally {
                            phaser.arriveAndDeregister();
                        }
                    }));
                } catch (RuntimeException submissionFailure) {
                    phaser.arriveAndDeregister();
                    throw submissionFailure;
                }
            }
            await(tasks);
        }

        phaser.arriveAndDeregister();
        return new Result(phaser.isTerminated(), phaser.getRegisteredParties());
    }

    private static void await(List<Future<?>> tasks) throws Exception {
        for (Future<?> task : tasks) {
            task.get();
        }
    }
}
