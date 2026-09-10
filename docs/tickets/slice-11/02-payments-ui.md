# 02 — Payments UI: method choice, gateway redirect, status badges, retry

**What to build:** checkout payment-method radio (COD / Online via
SSLCommerz) + online flow (order → init → navigate, seam-mocked in the
extended checkout test); payment badge on orders list + detail
(Paid / Awaiting payment / Payment failed — text, not color-only);
"Pay now" re-init on unpaid online orders; `?paid=` return notice with
refetch (webhook may land seconds after the redirect).

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Checkout radio + online redirect flow (payload test extended)
- [ ] Badges on orders list/detail from isPaid/payment.status
- [ ] Pay-now retry wired to /payments/init
- [ ] Return-notice + refetch on ?paid= query
