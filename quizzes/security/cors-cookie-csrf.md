---
id: security-cors-cookie-csrf
status: published
---

## Question

A logged-in user has `SESSION=...; Secure; HttpOnly; SameSite=None` for `api.bank.test`. CSRF and Origin checks are disabled. `/transfer` accepts form POSTs; CORS allows only `app.bank.test`. What happens when `evil.test` auto-submits this form?

```html
<form action="https://api.bank.test/transfer" method="post">
  <input name="to" value="attacker">
  <input name="amount" value="1000">
</form>
<script>document.forms[0].submit()</script>
```

## Answers

a. The browser blocks the POST because `evil.test` is absent from the CORS allowlist.
b. The POST can succeed with the cookie; CORS only prevents reading the response.
c. The browser preflights and cancels it because form-urlencoded POSTs need permission.
d. `HttpOnly` omits the cookie on cross-site requests, so the API sees no session.

<!-- correct-answer: b -->

<details>
<summary>Answer explanation</summary>

A form-urlencoded POST is sent without CORS preflight. `SameSite=None` includes the cookie; CORS can hide the response but does not stop the state-changing request.

</details>
