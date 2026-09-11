# 02 — Shipping UI: checkout choice, fee line, order timeline, settings editor

**What to build:** checkout shipping radio from settings (fee + ETA, first
preselected), Delivery line replacing hardcoded "Free", displayed total
includes the fee (payload test extended); `OrderTimeline` on the orders page
(history-driven dots/line, cancelled as red terminal mark, legacy fallback);
shipping line on order cards; Shipping-methods editor on the admin Settings
page (label/fee/eta rows, 1–5, axis-editor pattern).

**Blocked by:** 01.

**Status:** done

- [x] Checkout radio + fee line + payload test green
- [x] OrderTimeline rendering with history + fallback (browser-checked)
- [x] Shipping snapshot visible on order cards
- [x] Settings editor rows wired to the full-array PUT
