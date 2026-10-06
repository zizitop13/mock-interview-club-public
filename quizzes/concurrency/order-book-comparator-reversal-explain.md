# Preserving price-time priority when reversing a comparator

## Correct answer

a. Reverse only the price comparator, then append sequence in ascending order.

## Detailed explanation

The business invariant is: after the batch is fully submitted, the next buy order must have the highest price; among orders at that price, it must have the lowest unique exchange sequence.

Comparator chaining is evaluated before the final `reversed()` call. The original comparator first sorts price ascending and then sequence ascending. Calling `reversed()` on that completed comparator reverses both decisions: price becomes descending, which is desired, but sequence also becomes descending, so a later order wins an equal-price tie.

The queue itself remains structurally thread-safe. `PriorityBlockingQueue` can safely accept concurrent submissions, but it cannot infer the business ordering that its comparator failed to express. Since polling begins only after the batch is fully submitted, arrival timing is not part of the result; the comparator alone decides the match priority.

The fix scopes reversal to the price comparator and only then appends the ascending sequence tie-breaker. This directly encodes price-time priority without an extra lock or post-processing step.

## Code example

```java
private static final Comparator<Order> MATCH_PRIORITY =
    Comparator.comparingLong(Order::priceMicros)
        .reversed()
        .thenComparingLong(Order::sequence);
```

With this comparator, a price of 105 outranks 100, while sequence 41 outranks sequence 42 when both prices are 105. The runnable proof first shows the original comparator selecting the later tied order, then verifies both parts of the corrected ordering.

## Why the other options are incorrect

- b. Synchronization protects execution, but the queue still uses the same descending-sequence tie-breaker.
- c. FIFO ignores price priority and uses submission order, which need not equal the exchange sequence.
- d. Comparing sequence first makes it the primary key, and full reversal still favors larger sequences.
