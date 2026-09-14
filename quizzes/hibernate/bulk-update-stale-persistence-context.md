---
id: hibernate-bulk-update-stale-persistence-context
status: draft
---

## Question

Assume the row starts with `enabled=true`. Hibernate manages the loaded entity, no code calls `clear` or `refresh`, and no concurrent transaction runs. The transaction commits normally after this method returns. What does the method return, and what is stored in the database?

```java
@Transactional
public boolean disable(long accountId) {
    Account account = entityManager.find(Account.class, accountId);

    entityManager.createQuery(
            "update Account a set a.enabled = false where a.id = :id")
        .setParameter("id", accountId)
        .executeUpdate();

    return account.isEnabled();
}
```

## Answers

a. Returns `false`; the database stores `false` because Hibernate refreshes the managed entity.
b. Returns `true`; the database stores `false` because bulk DML bypasses the persistence context.
c. Returns `true`; the database stores `true` because dirty checking rewrites the managed snapshot.
d. Throws `OptimisticLockException` because every bulk update changes the version column.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

JPQL bulk DML updates the database directly and does not synchronize managed entities. The object stays `true`; because it was not dirtied, commit does not overwrite the database's `false` value.

</details>
