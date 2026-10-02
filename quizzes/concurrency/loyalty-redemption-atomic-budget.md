---
id: concurrency-loyalty-redemption-atomic-budget
status: draft
---

## Question

One JVM accepts loyalty redemptions against an exact daily points budget. Which smallest change preserves the budget under concurrent calls without one monitor?

```java
import java.util.concurrent.atomic.LongAdder;

public final class LoyaltyRedemptions {
    private final long dailyBudget;
    private final LongAdder redeemed = new LongAdder();

    public LoyaltyRedemptions(long dailyBudget) {
        if (dailyBudget <= 0) {
            throw new IllegalArgumentException("invalid budget");
        }
        this.dailyBudget = dailyBudget;
    }

    public boolean redeem(long points) {
        if (points <= 0) {
            throw new IllegalArgumentException("invalid points");
        }

        long current = redeemed.sum();
        if (points > dailyBudget - current) {
            return false;
        }

        redeemed.add(points);
        return true;
    }
}
```

## Answers

a. Add a second `LongAdder` for rejected points and keep the check unchanged.
b. Make `redeemed` volatile and keep `sum()` followed by `add(points)`.
c. Replace it with `AtomicLong` and use a CAS loop for the check and increment.
d. Call `sumThenReset()` before each check, then add the previous total back.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

The separate `sum`, budget check, and `add` can admit concurrent redemptions from the same total. A CAS loop makes admission and increment one conditional atomic update, protecting the exact daily budget.

</details>
