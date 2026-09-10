# 01 — The analytics endpoint: every dashboard number, one response

**What to build:** An admin with curl can read the whole state of the business in one
call: all-time totals (realized revenue = delivered; pending value =
pending/processing/shipped; orders; customers; average order value floored),
per-status order counts, the last-30-days daily series with realized/pending split
(UTC buckets by order creation date, current status deciding the line), top 5 products
by quantity from the item snapshots, and 30-day new-customer signups. Cancelled orders
appear in nothing. Computed by parallel aggregations; admin-gated.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Fixture world driven through real routes: realized counts only delivered; pending value sums exactly the in-pipeline statuses
- [x] An API-cancelled order appears in no metric
- [x] Discounted orders contribute their discounted totals (Slice 5 regression tie)
- [x] Status counts exact; top products by quantity with snapshot names
- [x] Today's bucket in the daily series carries the right realized/pending split
- [x] Customers total and 30-day signups exact; average order value floored
- [x] 401 anonymous / 403 non-admin
- [x] All existing tests still green; typecheck clean
