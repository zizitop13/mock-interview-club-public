---
id: java-switch-expression-return-vs-yield
status: draft
---

## Question

The compiler reports `attempt to return out of a switch expression`. What is the smallest correct fix?

```java
static int shippingCost(Parcel parcel) {
    int base = switch (parcel.zone()) {
        case LOCAL -> 5;
        case INTERNATIONAL -> {
            if (parcel.weightKg() > 20) {
                return 40;
            }
            yield 20;
        }
    };

    return addFuelSurcharge(base);
}
```

## Answers

a. Replace `return 40` with `break 40` to supply the value for that switch arm.
b. Keep `return 40`, but assign its value to `base` before leaving the method.
c. Replace `return 40` with `yield 40` so execution continues after the switch.
d. Add `continue` after `return 40` so the method resumes below the switch.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

Java does not allow `return` to leave a method from inside a switch expression. `yield 40` supplies the value of that switch arm, assigns it to `base`, and continues below the switch.

</details>
