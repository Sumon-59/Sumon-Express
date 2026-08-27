# 01 — Unified auth middleware + admin role tests (expand)

**What to build:** A single `requireAuth` middleware — verify the Bearer access token via
one shared token-verify helper, load the user, attach one consistent `req.user` — applied
first to the admin routes, which get their first real tests: 401 anonymous, 403
authenticated non-admin, 200 admin. The old middlewares stay in place everywhere else
(expand phase: new mechanism beside the old).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] One shared verify helper replaces hand-rolled jwt.verify at the new sites
- [ ] Admin routes answer 401 (anonymous), 403 (non-admin), 200 (admin) — tested
- [ ] All 17 existing backend tests still green, untouched
