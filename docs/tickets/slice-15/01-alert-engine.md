# 01 — Alert engine: threshold, edge-triggered detection, email

**What to build:** `lowStockThreshold` on the settings singleton
(validated, default 5, 0 = disabled); `claimItemStock` returns the
post-claim stock of the unit that moved; `createOrder` detects threshold
crossings using that return value and fires ONE batched email per admin
via a new `mail/inventoryEmails.ts`, only after the order actually commits
(never on a claim that later rolls back). TDD per the spec matrix.

**Blocked by:** nothing.

**Status:** done

- [x] `lowStockThreshold` validated (0–10000 integer, named 400s), default 5
- [x] `claimItemStock` returns `{claimed, stock}`; one call site updated
- [x] Edge-triggered crossing detection (above→at/below, not below→lower)
- [x] Batched per-order, per-admin email; admin-only recipients
- [x] No alert when a crossing's claim is later rolled back
- [x] `lowStockThreshold: 0` sends nothing
