# Returning from a method instead of yielding from a switch expression

## Correct answer

c. Replace `return 40` with `yield 40` so execution continues after the switch.

## Detailed explanation

A block arm of a Java switch expression must produce a value or throw an exception. Java rejects `return` here because control is not allowed to return from the enclosing method while evaluating a switch expression.

`yield 40` completes the nearest enclosing switch expression with the value `40`. That value is assigned to `base`, and execution continues with `addFuelSurcharge(base)`.

`return 40` tries to complete the entire `shippingCost` method. The compiler prevents that control transfer and reports `attempt to return out of a switch expression`.

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
- b. The value cannot be assigned while keeping `return`: Java rejects returning from inside a switch expression.
- d. Code after `return` is unreachable, and `continue` applies to loops rather than resuming an enclosing method.
