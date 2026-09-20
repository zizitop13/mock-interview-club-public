# REQUIRES_NEW pool starvation

This module makes the quiz assumptions executable with Spring JDBC, HikariCP, H2, and a 20-party `CyclicBarrier`.

- `reproducesStarvationWhenEveryConnectionIsHeldByAnOuterTransaction` passes when all 20 calls are blocked waiting for inner connections. It proves the broken 20-connection configuration without making the build fail.
- `oneSpareConnectionLetsEveryInnerTransactionFinish` uses 21 connections and proves that one reusable spare connection is sufficient for progress in this closed scenario.

Run it from the repository root:

```bash
mvn --file quiz-projects/spring/hibernate/jdbc-requires-new-pool-starvation/pom.xml test
```
