# Pattern-switch dominance in a message router

## Correct answer

a. Move the guarded `String` case before `CharSequence`, keeping the text fallback after it.

## Detailed explanation

Pattern switch cases are tested from top to bottom, but Java also rejects cases that can never be selected. An unguarded `CharSequence` type pattern matches every non-null `String`, so the later `String` pattern is dominated and the method does not compile.

The guard does not make the later case reachable. Java must first reach the `String` case before it can evaluate `startsWith`, but the earlier `CharSequence` case has already accepted the value.

Order patterns from specific to general. The guarded `String` case can classify JSON-looking strings first. If its guard is false, matching continues to the broader `CharSequence` fallback. This is the same principle used when ordering subtype patterns before their supertypes.

## Code example

```java
enum Route { JSON, TEXT, EMPTY, OTHER }

static Route route(Object message) {
    return switch (message) {
        case String json when json.stripLeading().startsWith("{") -> Route.JSON;
        case CharSequence text -> Route.TEXT;
        case null -> Route.EMPTY;
        default -> Route.OTHER;
    };
}
```

A JSON string now selects `JSON`. Other strings and implementations such as `StringBuilder` select `TEXT`; null and unrelated objects use their own cases.

## Why the other options are incorrect

- b. `Object` is even broader than `CharSequence` and would dominate every later non-null type pattern.
- c. A `default` label is a fallback, not a way to continue into a later case, and placing it earlier does not repair dominance.
- d. `var` is not a replacement type pattern here, and renaming or changing the pattern variable cannot alter the subtype relationship.
