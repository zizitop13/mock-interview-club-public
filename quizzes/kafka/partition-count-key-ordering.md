---
id: kafka-partition-count-key-ordering
status: published
---

## Question

What can happen when a Kafka topic grows from 3 to 6 partitions?

```mermaid
flowchart LR
    Key["Key: order-42<br/>Hash: 10"]
    subgraph Before["Before: 3 partitions"]
        old0["Partition 0"]
        old1["Partition 1"]
        old2["Partition 2"]
    end
    subgraph After["After: 6 partitions"]
        new0["Partition 0"]
        new1["Partition 1"]
        new2["Partition 2"]
        new3["Partition 3"]
        new4["Partition 4"]
        new5["Partition 5"]
    end
    Key -->|"10 % 3 = 1"| old1
    Key -->|"10 % 6 = 4"| new4
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
