---
id: kafka-partition-count-key-ordering
status: published
---

## Question

What can happen when a Kafka topic grows from 3 to 6 partitions?

```plantuml
@startuml
left to right direction

rectangle "Before: 3 partitions" {
  queue "Partition 0" as old0
  queue "Partition 1" as old1
  queue "Partition 2" as old2
}

rectangle "After: 6 partitions" {
  queue "Partition 0" as new0
  queue "Partition 1" as new1
  queue "Partition 2" as new2
  queue "Partition 3" as new3
  queue "Partition 4" as new4
  queue "Partition 5" as new5
}

cloud "Key: order-42\nHash: 10" as key

key --> old1 : 10 % 3 = 1
key --> new4 : 10 % 6 = 4
@enduml
```

## Answers

a. Existing messages are redistributed across all six partitions.
b. Consumers must restart before reading the new partitions.
c. The replication factor automatically increases to six.
d. Messages with the same key may no longer remain ordered.

<!-- correct-answer: d -->

<details>
<summary>Answer explanation</summary>

Increasing the partition count can remap a key to another partition. Old and new messages may then reside in different partitions, where Kafka does not guarantee their relative ordering.

</details>
