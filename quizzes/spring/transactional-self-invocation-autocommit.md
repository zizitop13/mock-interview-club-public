---
id: spring-transactional-self-invocation-autocommit
status: published
---

## Question

Assume Spring uses proxy-based transaction management. `checkout` is called through the bean proxy with no existing transaction, and the pool has `autoCommit=true`. `charge` throws a `RuntimeException` after the update returns. What happens?

```java
@Service
class CheckoutService {
    private final JdbcTemplate jdbc;
    private final PaymentClient paymentClient;

    public void checkout(long orderId) {
        markProcessing(orderId);
        paymentClient.charge(orderId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markProcessing(long orderId) {
        jdbc.update(
            "update orders set status = 'PROCESSING' where id = ?",
            orderId
        );
    }
}
```

## Answers

a. `markProcessing` has no Spring transaction; JDBC auto-commits, so the update remains.
b. `REQUIRES_NEW` starts, but the later exception rolls back that completed inner transaction.
c. `checkout` inherits transaction advice from the class, so the exception rolls back the update.
d. Spring rejects the self-call before executing SQL because only proxy methods may be called.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

The self-call never crosses Spring's transaction proxy, so `REQUIRES_NEW` is not applied. With no outer transaction and auto-commit enabled, the JDBC update commits before `charge` fails.

</details>
