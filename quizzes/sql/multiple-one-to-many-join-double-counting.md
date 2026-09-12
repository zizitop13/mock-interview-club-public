---
id: sql-multiple-one-to-many-join-double-counting
status: draft
---

## Question

An order has two payment rows and three refund rows. This report returns inflated totals even though each table is correct. Which rewrite preserves one total for each order?

```sql
SELECT o.id,
       SUM(p.amount) AS paid,
       SUM(r.amount) AS refunded
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
LEFT JOIN refunds r ON r.order_id = o.id
GROUP BY o.id;
```

## Answers

a. Use SUM(DISTINCT amount) for both children to remove rows duplicated by the joins.
b. Aggregate each child by order_id first, then join the two one-row-per-order results.
c. Change both LEFT JOIN clauses to INNER JOIN so unmatched rows cannot inflate totals.
d. Add payment and refund IDs to GROUP BY so each joined row contributes only once.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

Both children are one-to-many. Joining them first creates every payment/refund pair, repeating amounts. Aggregate each child to one row per order before joining.

</details>
