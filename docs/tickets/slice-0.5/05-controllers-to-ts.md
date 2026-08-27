# 05 — Controllers → TypeScript

**What to build:** All six controllers (auth, user, product, category, order, admin
order) typed: request bodies, params, and response payloads have explicit shapes, and the
compiler enforces that handlers only touch fields the models actually declare.

**Blocked by:** 04 — Middleware → TypeScript.

**Status:** ready-for-agent (owner: Sumon, Claude reviews each controller)

- [ ] Request body shapes for register/login/create-order/create-product are named types
- [ ] No `any` escapes; unknown boundary data is narrowed, not silenced
- [ ] Type check passes on the converted files
- [ ] All 17 backend tests still green, unmodified
