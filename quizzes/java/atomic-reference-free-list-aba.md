---
id: java-atomic-reference-free-list-aba
status: published
---

## Question

This lock-free free-list passes single-threaded tests. How can `pop()` corrupt the list when removed nodes are reused?

```java
final class FreeList {
    private final AtomicReference<Node> head = new AtomicReference<>();

    Node pop() {
        while (true) {
            Node observed = head.get();
            if (observed == null) {
                return null;
            }

            Node next = observed.next;
            if (head.compareAndSet(observed, next)) {
                return observed;
            }
        }
    }

    void push(Node node) {
        Node observed;
        do {
            observed = head.get();
            node.next = observed;
        } while (!head.compareAndSet(observed, node));
    }

    static final class Node {
        Node next;
    }
}
```

## Answers

a. CAS compares every Node field, so concurrent changes to next can make it accept stale state.
b. AtomicReference permits both pop calls to remove the same head before either CAS completes.
c. The head can return to the same reference, letting CAS install a stale next pointer.
d. Reusing a removed node lets the garbage collector clear its next field during the CAS.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

This is the ABA problem: the head may change from A to B and back to A, so identity-based CAS succeeds and installs a stale successor captured before those changes.

</details>
