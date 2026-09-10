# 02 — Preview endpoint and admin discount CRUD

**What to build:** A shopper (any authenticated user) can ask "what would this code do
to this cart?" — the preview endpoint recomputes the subtotal from DB prices, runs the
same rules function, and answers `{code, subtotal, discountAmount, total}` or the named
400, consuming nothing. An admin can create codes (validated like products: 400 naming
the field — bad type, percent outside 1–100, non-positive fixed value, negative
minOrder, duplicate code even across casing), edit them partially (validated against
effective values), deactivate/reactivate via update (no hard delete — snapshots and
history outlive campaigns), and list them newest-first with the shared pagination
wrapper and visible usage counts.

**Blocked by:** 01 — the model and rules function are this ticket's foundation.

**Status:** ready-for-agent

- [ ] Preview: correct numbers for percent and fixed; named 400s; does not touch usedCount; 401 anonymous
- [ ] Create: field-naming 400s for every invalid input; duplicate code (any casing) 400
- [ ] Update: partial edits validated against effective values; deactivate + reactivate work
- [ ] Listing: `{discounts, total, page, pages}` via the shared helper, newest first, usedCount visible
- [ ] 401/403 on all admin discount routes
- [ ] All existing tests still green; typecheck clean
