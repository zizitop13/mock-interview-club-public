# Enforcing an exact loyalty redemption budget

## Correct answer

c. Replace it with `AtomicLong` and use a CAS loop for the check and increment.

## Detailed explanation

The business invariant is: the sum of successful redemptions in the authoritative JVM must never exceed the daily points budget.

`LongAdder` is designed for scalable statistics, not conditional updates that enforce a hard limit. Its `sum()` is not an atomic snapshot with respect to concurrent updates. More importantly, the code separates the read, limit check, and increment. If the budget is 100 points, two threads redeeming 60 points can both observe zero, both pass the check, and both add 60. Both calls return `true`, and the service has accepted 120 points.

An `AtomicLong` CAS loop combines the business decision with the state transition. A thread reads the current total, rejects an amount that would exceed the budget, and changes that exact observed total only if no competing redemption changed it first. On a failed CAS, the thread retries and re-evaluates the budget against the newer total.

## Code example

```java
import java.util.concurrent.atomic.AtomicLong;

public final class LoyaltyRedemptions {
    private final long dailyBudget;
    private final AtomicLong redeemed = new AtomicLong();

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

        while (true) {
            long current = redeemed.get();
            if (points > dailyBudget - current) {
                return false;
            }
            if (redeemed.compareAndSet(current, current + points)) {
                return true;
            }
        }
    }
}
```

The subtraction form avoids overflow in the limit check because the constructor requires a positive budget, the method requires positive points, and the CAS implementation never lets `current` exceed the budget. The loop contains no external side effect, so retrying it cannot duplicate a business action.

The runnable proof uses a barrier to make two unsafe calls read the same zero total before either adds 60, and verifies that both succeed against a 100-point budget. A separate green test starts two CAS-based calls together and verifies that exactly one succeeds and the accepted total remains 60.

The stated one-JVM boundary matters. If several processes accept redemptions against the same budget, the conditional update must instead be enforced by their shared database or another cross-process serialization boundary.

## Why the other options are incorrect

- a. A rejected-points counter adds observability, but it does not make the admission check and increment atomic.
- b. A volatile reference does not combine `sum()`, the budget check, and `add(points)` into one state transition.
- d. Resetting and restoring the counter creates more race windows and can temporarily discard concurrent redemptions.
