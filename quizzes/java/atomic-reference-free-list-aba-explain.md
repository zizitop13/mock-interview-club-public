# ABA corruption in an AtomicReference free-list

## Correct answer

c. The head can return to the same reference, letting CAS install a stale next pointer.

## Detailed explanation

`compareAndSet(expected, update)` on an `AtomicReference` checks whether the current reference is identical to `expected`. It does not record how many times the reference changed or whether the node's links changed in between.

Assume the list starts as `A -> B -> C`:

1. Thread T1 reads `observed = A` and `next = B`, then pauses.
2. Thread T2 pops A, pops B, and gives B to a caller.
3. T2 pushes A back. The list is now `A -> C`.
4. T1 executes `compareAndSet(A, B)`. It succeeds because the head is A again.
5. The list head becomes B, even though B is already in use, and A is lost from the list.

The atomic operation is behaving exactly as specified. The algorithm is wrong because reference equality alone cannot distinguish the original A state from a later A state. This is the ABA problem, which is especially relevant when nodes are pooled or reused.

```mermaid
sequenceDiagram
    participant T1
    participant Head
    participant T2
    Note over Head: A -> B -> C
    T1->>Head: read A and stale next B
    T2->>Head: pop A
    T2->>Head: pop B
    Note over T2: B is handed to a caller
    T2->>Head: push A
    Note over Head: A -> C
    T1->>Head: CAS(A, B) succeeds
    Note over Head: B -> C; A is lost
```

A common fix is to attach a generation stamp to the head. Each successful mutation increments the stamp, so T1's CAS fails even if the reference returns to A. Another valid design is to avoid reusing nodes while any thread might still hold an old reference, using an appropriate reclamation strategy.

## Code example

```java
final class StampedFreeList {
    private final AtomicStampedReference<Node> head =
        new AtomicStampedReference<>(null, 0);

    Node pop() {
        int[] stamp = new int[1];

        while (true) {
            Node observed = head.get(stamp);
            if (observed == null) {
                return null;
            }

            Node next = observed.next;
            if (head.compareAndSet(
                    observed, next, stamp[0], stamp[0] + 1)) {
                return observed;
            }
        }
    }

    void push(Node node) {
        int[] stamp = new int[1];

        while (true) {
            Node observed = head.get(stamp);
            node.next = observed;

            if (head.compareAndSet(
                    observed, node, stamp[0], stamp[0] + 1)) {
                return;
            }
        }
    }

    static final class Node {
        Node next;
    }
}
```

The reference and stamp are compared as one logical state. In the earlier interleaving, T2's mutations advance the stamp, so T1 cannot commit its stale `next` value.

The integer stamp can eventually wrap around, so a production design must consider mutation rate and object lifetime. Safe memory reclamation or eliminating node reuse may be more suitable for a long-lived, extremely high-throughput structure.

## Why the other options are incorrect

- a. `AtomicReference.compareAndSet` compares reference identity, not the mutable fields inside a Node.
- b. Two callers may read the same head, but only one CAS can remove that exact head state first.
- d. A strongly reachable removed node is not cleared by the garbage collector; GC does not mutate `next`.
