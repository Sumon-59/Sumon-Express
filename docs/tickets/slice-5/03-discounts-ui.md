# 03 — Discounts UI: admin CRUD pages and the checkout code field

**What to build:** The admin sidebar's Discounts link comes alive: a table (code, type +
value, min order, expiry, usage x/limit, status pill) with the products-section
create/edit form pages and deactivate/reactivate actions. At checkout, a code field with
Apply calls the preview endpoint and shows the discount line + recomputed total; Remove
resets it; server rejections show their exact message; the applied code rides the
existing order payload. The shopper's order history and the admin order drawer show the
snapshot line ("EID10 −৳120") on discounted orders.

**Blocked by:** 02 — the UI consumes the preview and CRUD APIs.

**Status:** ready-for-agent

- [x] Admin table + create/edit forms + deactivate/reactivate, errors via the shared helper
- [x] Checkout: Apply shows discount + new total; Remove resets; server messages verbatim (component-tested with mocked adapters)
- [x] Applied code included in the create-order payload (component-tested)
- [x] Order history + admin drawer render the discount snapshot line
- [x] All existing tests still green; frontend build green
