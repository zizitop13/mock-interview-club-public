---
id: spring-caught-inner-rollback-only
status: published
---

## Question

Assume both calls go through Spring proxies, `place` starts a JDBC transaction, `recordAndFail` joins it with default `REQUIRED`, and default rollback rules apply. The method body catches the unchecked exception and reaches its end. What does the proxy caller observe?

```java
@Service
class OrderService {
    @Transactional
    public void place(long id) {
        jdbc.update("insert into customer_orders(id) values (?)", id);
        try {
            audit.recordAndFail(id);
        } catch (IllegalStateException ignored) {
        }
    }
}

@Service
class AuditService {
    @Transactional
    public void recordAndFail(long id) {
        jdbc.update("insert into audit_events(order_id) values (?)", id);
        throw new IllegalStateException("audit failed");
    }
}
```

## Answers

a. It returns normally; both inserts commit because the exception was caught.
b. It returns normally; only `customer_orders` commits because the audit insert rolls back.
c. It throws `UnexpectedRollbackException`; both inserts roll back.
d. It rethrows `IllegalStateException`; both inserts roll back.

<!-- correct-answer: c -->

<details>
<summary>Answer explanation</summary>

The inner proxy marks the shared transaction rollback-only before rethrowing. Catching the exception cannot clear it, so outer commit throws `UnexpectedRollbackException` and rolls back both inserts.

</details>
