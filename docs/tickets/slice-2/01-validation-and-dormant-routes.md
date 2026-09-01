# 01 — Validation + the dormant routes come alive (backend)

**What to build:** Product data rules enforced server-side on create and update — price
non-negative, stock a non-negative whole number, discount strictly below price, violations
answering 400 naming the field — and the long-dormant update/delete routes enabled behind
the admin gate, with delete meaning deactivate (soft delete). Partial updates change only
the provided fields.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Validation rejections tested: negative price, negative/fractional stock, discount ≥ price
- [ ] Partial update changes only provided fields (tested)
- [ ] Delete deactivates: product vanishes from public listing and detail (tested)
- [ ] Update/delete answer 401 anonymous, 403 non-admin
- [ ] All existing tests still green
