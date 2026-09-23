---
id: observability-fleet-percentile-aggregation
status: draft
---

## Question

An API SLO requires the exact fleet p99 over all requests in one five-minute window. Each pod exports only its request count and nearest-rank p99 for that same window. The dashboard computes a count-weighted average of pod p99 values. Which statement is correct?

```text
pod A: count=100, p99=10 ms
pod B: count=100, p99=20 ms
dashboard: (100 * 10 + 100 * 20) / 200 = 15 ms
```

## Answers

a. Weighted averaging is exact because request counts preserve each pod's traffic share.
b. The gauges are insufficient; merge request observations first, then compute the fleet p99.
c. The maximum pod p99 is exact because the slowest pod determines the fleet tail.
d. Equal pod traffic makes the unweighted average an exact fleet percentile.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

Percentiles are not additive. Local p99 values and counts discard each pod's distribution, so neither weighted averaging nor taking the maximum can recover the exact fleet p99.

</details>
