# 01 — Payment engine: provider abstraction, init, verified IPN, redirects

**What to build:** `PaymentProvider` interface + `getPaymentProvider()` env
selection; fake provider (test) mirroring the real contract; SSLCommerz
implementation (session + validator-API verification, sandbox base URL);
Order `payment` subdoc + `"online"` method; `/api/payments` routes: init
(auth, named 400s, re-init with fresh tranId), IPN (public, verify → amount
match → idempotent paid; tamper/unverified/superseded/unknown all refused),
redirect 303s. TDD the security matrix per the spec.

**Blocked by:** nothing.

**Status:** ready-for-agent

- [ ] Provider interface + fake + SSLCommerz impl; env selection
- [ ] init matrix green (auth/ownership/method/paid/happy/re-init)
- [ ] IPN matrix green (verified-paid, tampered, unverified, failed,
      unknown, superseded, idempotent)
- [ ] Redirect 303s green; COD regression suite untouched and green
