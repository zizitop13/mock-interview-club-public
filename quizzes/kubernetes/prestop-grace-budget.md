---
id: kubernetes-prestop-grace-budget
status: draft
---

## Question

A Spring Boot app starts graceful shutdown on SIGTERM and needs up to 25 seconds. Kubernetes starts the Pod grace countdown before a 15-second `preStop` hook and sends SIGTERM after the hook. With `terminationGracePeriodSeconds: 30`, what follows? Assume exact timings and no kubelet restart.

```yaml
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: checkout
      lifecycle:
        preStop:
          exec:
            command: ["sh", "-c", "sleep 15"]
```

## Answers

a. The app gets 15 s; set the Pod grace period to at least 40 s, plus operational margin.
b. The app gets 25 s because the preStop hook runs outside the Pod grace period.
c. The app gets 30 s because SIGTERM starts a separate application shutdown timer.
d. The app gets 15 s; a readiness probe extends the remaining Pod grace period to 25 s.

<!-- correct-answer: a -->

<details>
<summary>Answer explanation</summary>

The 15-second hook consumes half of the 30-second Pod grace period, leaving only 15 seconds after SIGTERM. Budget at least 15 + 25 seconds, then add margin.

</details>
