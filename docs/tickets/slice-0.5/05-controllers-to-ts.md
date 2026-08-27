# 05 — Controllers → TypeScript

**What to build:** All six controllers (auth, user, product, category, order, admin
order) typed: request bodies, params, and response payloads have explicit shapes. Models
are still JavaScript at this point, so model values are typed loosely at this ticket's
boundary and tighten automatically when ticket 06 lands.

**Blocked by:** 04 — Middleware → TypeScript.

**Status:** ready-for-agent (owner: Sumon, Claude reviews each controller)

- [ ] Request body shapes for register/login/create-order/create-product are named types
- [ ] No `any` escapes; unknown boundary data is narrowed, not silenced
- [ ] Type check passes on the converted files
- [ ] All 17 backend tests still green, unmodified
