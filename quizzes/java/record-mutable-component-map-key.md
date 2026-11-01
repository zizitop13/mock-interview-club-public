---
id: java-record-mutable-component-map-key
status: draft
---

## Question

This record is used as a concurrent-map key because records look immutable. What can happen, and what is the best fix?

```java
record BatchKey(List<String> accountIds) {}

List<String> ids = new ArrayList<>(List.of("A-17"));
BatchKey key = new BatchKey(ids);

ConcurrentMap<BatchKey, BigDecimal> totals = new ConcurrentHashMap<>();
totals.put(key, new BigDecimal("125.00"));

ids.add("A-42");
BigDecimal total = totals.get(key);
```

## Answers

a. `get` is reliable because record components are final; no change is required.
b. Synchronize `get` and every mutation of `ids` on the map instance.
c. Override `hashCode` to return a constant so the key always stays in one bin.
d. Copy the list in a compact constructor with `accountIds = List.copyOf(accountIds)`.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

Records are only shallowly immutable. Mutating the list changes the generated hash code after insertion, so lookup can miss; an immutable defensive copy stabilizes the key.

</details>
