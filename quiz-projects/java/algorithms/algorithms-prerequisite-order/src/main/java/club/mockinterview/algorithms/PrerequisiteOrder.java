package club.mockinterview.algorithms;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

public final class PrerequisiteOrder {
    private PrerequisiteOrder() {}

    public static int[] order(int taskCount, int[][] edges) {
        List<List<Integer>> successors = new ArrayList<>(taskCount);
        for (int task = 0; task < taskCount; task++) {
            successors.add(new ArrayList<>());
        }

        int[] indegree = new int[taskCount];
        for (int[] edge : edges) {
            successors.get(edge[0]).add(edge[1]);
            indegree[edge[1]]++;
        }

        Deque<Integer> ready = new ArrayDeque<>();
        for (int task = 0; task < taskCount; task++) {
            if (indegree[task] == 0) {
                ready.add(task);
            }
        }

        int[] result = new int[taskCount];
        int size = 0;

        while (!ready.isEmpty()) {
            int completed = ready.remove();
            result[size++] = completed;

            for (int successor : successors.get(completed)) {
                indegree[successor]--;
                if (indegree[successor] == 0) {
                    ready.add(successor);
                }
            }
        }

        return size == taskCount ? result : new int[0];
    }
}
