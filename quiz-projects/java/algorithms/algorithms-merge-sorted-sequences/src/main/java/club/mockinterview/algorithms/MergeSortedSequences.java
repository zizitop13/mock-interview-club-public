package club.mockinterview.algorithms;

import java.util.Comparator;
import java.util.PriorityQueue;

public final class MergeSortedSequences {
    private MergeSortedSequences() {}

    public static int[] merge(int[][] sequences) {
        int totalSize = 0;
        PriorityQueue<Entry> heads = new PriorityQueue<>(
                Comparator.comparingInt(Entry::value)
                        .thenComparingInt(Entry::sequence));

        for (int sequence = 0; sequence < sequences.length; sequence++) {
            totalSize += sequences[sequence].length;
            if (sequences[sequence].length > 0) {
                heads.add(new Entry(sequences[sequence][0], sequence, 0));
            }
        }

        int[] merged = new int[totalSize];
        int outputIndex = 0;

        while (!heads.isEmpty()) {
            Entry smallest = heads.remove();
            merged[outputIndex++] = smallest.value();

            int nextIndex = smallest.index() + 1;
            int[] source = sequences[smallest.sequence()];
            if (nextIndex < source.length) {
                heads.add(new Entry(
                        source[nextIndex],
                        smallest.sequence(),
                        nextIndex));
            }
        }

        return merged;
    }

    private record Entry(int value, int sequence, int index) {}
}
