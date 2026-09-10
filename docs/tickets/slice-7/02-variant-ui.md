# 02 — Variant UI: picker, gallery, cart identity, admin axis editor

**What to build:** The product page gains a value picker (sold-out values disabled,
price/availability follow the selection, add-to-cart requires a choice) and a real
gallery (thumbnails switch the main image). The cart keys lines by product+variant —
S and M are separate lines; legacy carts load unchanged (cart-hook tests extended).
Checkout sends `variant` per line. The admin product form gets the axis editor
(optionName + value rows with name/stock/price override, replacing the single stock
input while on). Order views everywhere show "Name · Value".

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Picker: selection drives price/stock; sold-out values disabled; add-to-cart gated
- [ ] Gallery: thumbnails switch the main image; first image default
- [ ] Cart-hook tests: product+variant identity, quantity bump on same value, legacy lines unaffected
- [ ] Checkout payload carries variant per line
- [ ] Admin form axis editor with validation mirror; products table shows summed stock
- [ ] Order views (shopper history, admin drawer, checkout summary) show the value
- [ ] All existing tests still green; frontend build green
