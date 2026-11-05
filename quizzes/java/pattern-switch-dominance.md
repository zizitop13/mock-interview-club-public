---
id: java-pattern-switch-dominance
status: draft
---

## Question

A message router adds a JSON fast path, but CI reports that one case is dominated. What is the smallest correct fix?

```java
static Route route(Object message) {
    return switch (message) {
        case CharSequence text -> Route.TEXT;
        case String json when json.stripLeading().startsWith("{") -> Route.JSON;
        case null -> Route.EMPTY;
        default -> Route.OTHER;
    };
}
```

## Answers

a. Move the guarded `String` case before `CharSequence`, keeping the text fallback after it.
b. Replace `CharSequence` with `Object` and keep the current order to make the switch exhaustive.
c. Put `default` before the `String` case so unmatched text continues to the JSON handler.
d. Change the `String` pattern variable to `var` so the compiler treats the cases as unrelated.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

Every `String` is a `CharSequence`, so the first case already matches it. Put the guarded `String` case first, then keep `CharSequence` as the fallback.

</details>
