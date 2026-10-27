# Returning from a method instead of yielding from a switch expression

## Correct answer

c. Replace `return 40` with `yield 40` so execution continues after the switch.

## Detailed explanation

A block arm of a Java switch expression must either produce a value or complete abruptly. Both `yield` and `return` compile here, but they transfer control to different places.

`yield 40` completes the nearest enclosing switch expression with the value `40`. That value is assigned to `base`, and execution continues with `addFuelSurcharge(base)`.

`return 40` completes the entire `shippingCost` method immediately. The local variable `base` is never assigned on that path because control never reaches the assignment or the final return statement. This is legal Java, so the mistake can survive compilation and ordinary tests that do not cover heavy international parcels.

Expression arms such as `case LOCAL -> 5` produce their value directly. A block arm needs `yield` when it calculates a value through statements.

## Code example

```java
static int shippingCost(Parcel parcel) {
    int base = switch (parcel.zone()) {
        case LOCAL -> 5;
        case INTERNATIONAL -> {
            if (parcel.weightKg() > 20) {
                yield 40;
            }
            yield 20;
        }
    };

    return addFuelSurcharge(base);
}

static int addFuelSurcharge(int base) {
    return base + base / 10;
}
```

For a heavy international parcel, the switch now evaluates to `40`. The method then applies the surcharge and returns `44`.

## Why the other options are incorrect

- a. Modern Java uses `yield` to provide a value from a switch block. `break 40` is not valid switch-expression syntax.
- b. A `return` always exits the enclosing method. Assigning another value first does not make execution continue after it.
- d. Code after `return` is unreachable, and `continue` applies to loops rather than resuming an enclosing method.
