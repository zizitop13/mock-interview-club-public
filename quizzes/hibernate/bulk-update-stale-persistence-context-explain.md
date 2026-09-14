# Hibernate bulk updates and stale managed entities

## Correct answer

b. Returns `true`; the database stores `false` because bulk DML bypasses the persistence context.

## Detailed explanation

`entityManager.find` loads the row and places an `Account` with `enabled=true` in the persistence context. Hibernate also keeps the loaded state for dirty checking.

The JPQL `UPDATE` is bulk DML. It is translated into SQL and applied directly to matching database rows; Hibernate does not apply that change to entity instances that are already managed. After `executeUpdate`, the database row has `enabled=false`, while the in-memory `account` still has `enabled=true`. The method therefore returns `true`.

At commit, dirty checking compares the managed object's current value, `true`, with its originally loaded value, also `true`. Nothing in the example changed the managed object, so Hibernate has no entity update to flush. The bulk update commits and the database retains `false`.

An automatic flush before the bulk query would only send pending entity changes to the database. It would not refresh managed entities after the query. Likewise, bulk JPQL does not automatically perform per-entity optimistic-lock checks or increment a version attribute unless the query explicitly does so.

```mermaid
sequenceDiagram
    participant S as Service
    participant P as Persistence context
    participant D as Database
    S->>P: find account
    P->>D: SELECT enabled
    D-->>P: true
    S->>D: bulk UPDATE enabled false
    D-->>S: one row updated
    S->>P: read managed account
    P-->>S: true
    Note over P,D: Managed value is true; database value is false
```

For one entity, changing the managed object is usually clearer because dirty checking, lifecycle callbacks, and optimistic locking remain in the normal entity workflow. If bulk DML is intentional, clear or refresh the persistence context before relying on managed state again.

## Code example

```java
@Transactional
public boolean disableOne(long accountId) {
    Account account = entityManager.find(Account.class, accountId);
    account.setEnabled(false);
    return account.isEnabled(); // false; Hibernate flushes the change at commit
}

@Transactional
public boolean disableInBulkAndReload(long accountId) {
    entityManager.createQuery(
            "update Account a set a.enabled = false where a.id = :id")
        .setParameter("id", accountId)
        .executeUpdate();

    entityManager.clear();
    Account reloaded = entityManager.find(Account.class, accountId);
    return reloaded.isEnabled(); // false
}
```

Clearing detaches every entity in the persistence context, so a targeted `refresh(account)` may be preferable when other managed changes must remain attached. For large bulk operations, define the transaction boundary so stale entities are not used after the DML.

## Why the other options are incorrect

- a. Hibernate does not automatically refresh managed entities after JPQL bulk DML. The already loaded object keeps `enabled=true` until it is refreshed, cleared and reloaded, or discarded with the persistence context.
- c. Dirty checking sees no difference between the managed value and its original snapshot, both `true`, so it emits no entity update that could overwrite the bulk change.
- d. Bulk JPQL does not inherently increment a version column or throw `OptimisticLockException`. Version handling must be included deliberately when bulk DML needs it.
