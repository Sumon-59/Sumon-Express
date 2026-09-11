# 01 — Shipping engine: methods in settings, server-priced fee, snapshot, history

**What to build:** `shippingMethods` on StoreSettings (defaults, full-array
replace, validation folded into `validateSettingsData` — 1–5 methods, whole-
taka fees, unique keys, named 400s); order creation requires a known
`shippingMethod`, snapshots `{key,label,fee,eta}`, prices
`totalPrice = subtotal − discount + fee` (discount never sees the fee);
`history: [{status,at}]` seeded at creation and appended by the ONE
`recordStatus` helper in the status route + both cancel paths. TDD per the
spec matrix.

**Blocked by:** nothing.

**Status:** done

- [x] Settings: defaults + replace + validation matrix green
- [x] Pricing: fee added server-side, snapshot holds across fee edits,
      discount math untouched by fee; refusals pre-side-effect
- [x] History: seeded, appended on every legal transition + both cancels,
      never on illegal moves
- [x] Payments regression green (fee-inclusive totalPrice end to end)
