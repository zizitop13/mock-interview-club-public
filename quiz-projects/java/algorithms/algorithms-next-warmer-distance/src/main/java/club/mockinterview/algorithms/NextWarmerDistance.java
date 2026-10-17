package club.mockinterview.algorithms;

import java.util.ArrayDeque;
import java.util.Deque;

public final class NextWarmerDistance {
    private NextWarmerDistance() {}

    public static int[] distances(int[] temperatures) {
        int[] answer = new int[temperatures.length];
        Deque<Integer> unresolved = new ArrayDeque<>();

        for (int i = 0; i < temperatures.length; i++) {
            while (!unresolved.isEmpty()
                    && temperatures[i] > temperatures[unresolved.peek()]) {
                int previous = unresolved.pop();
                answer[previous] = i - previous;
            }
            unresolved.push(i);
        }

        return answer;
    }
}
