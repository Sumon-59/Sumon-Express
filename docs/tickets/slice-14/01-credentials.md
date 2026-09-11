# 01 — Credentials: reset by hashed token, password change, login notification

**What to build:** forgot/reset endpoints (hashed-at-rest single-use
expiring token, constant 200, reset email via the Slice 13 mailer, global
refresh revocation, confirmation email); authenticated password change
(current-password proof, same policy as register, fresh session for the
caller, others die); login notification email. `utils/clientUrl.ts`
extracted from payments and reused. TDD per the spec matrix.

**Blocked by:** nothing.

**Status:** ready-for-agent

- [ ] Forgot: constant response, email only for real users, token hashed
- [ ] Reset: single-use, expiring, revokes refresh, confirmation email
- [ ] Change: current proved, policy mirrored, fresh session, email
- [ ] Login notification on success only
