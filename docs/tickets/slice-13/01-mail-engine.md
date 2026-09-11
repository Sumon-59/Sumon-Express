# 01 — Mail engine: mailer abstraction, three triggers, failure isolation

**What to build:** mailer interface + fake (outbox, `failNext()`), Resend
(plain fetch, timeout), console fallback; `orderEmails.ts` builders reading
ONLY the order snapshot; fire-and-forget wiring into createOrder,
updateOrderStatus, both cancel doors; `GET /api/admin/mail-status`. TDD per
the spec matrix.

**Blocked by:** nothing.

**Status:** ready-for-agent

- [ ] Mailer selection + fake outbox + console/resend impls
- [ ] Confirmation email content matrix green (items/shipping/discount/total)
- [ ] Status + cancellation triggers green; refused orders send nothing
- [ ] failNext(): mail failure never fails a request; mail-status endpoint
