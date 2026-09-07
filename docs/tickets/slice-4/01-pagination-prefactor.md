# 01 — Prefactor: one pagination helper for all listings

**What to build:** Nothing an admin can see. The page/limit parsing and the
`{page, pages, total}` wrapper math — currently hand-rolled identically in the products
and orders listings — becomes one shared helper, and both listings adopt it. Behavior is
byte-identical; the existing listing tests prove it by staying green without a single
edit. This is the rule-of-three extraction scheduled in Slice 3's review, landed first so
the customers listing (ticket 02) is its third consumer instead of a third copy.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Shared helper owns page/limit parsing and pages math
- [ ] Products listing adopts it; its tests pass unmodified
- [ ] Orders listing adopts it; its tests pass unmodified
- [ ] No response shape or behavior change anywhere
- [ ] Typecheck clean
