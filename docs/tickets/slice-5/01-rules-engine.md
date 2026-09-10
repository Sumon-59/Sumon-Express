# 01 — The Discount model and the rules engine at the order seam

**What to build:** Discount codes exist and change what shoppers pay. The Discount model
(unique uppercase code, percent|fixed + value, minOrder, optional expiresAt, optional
usageLimit, usedCount, isActive) plus the one shared rules function — unknown / inactive
/ expired / below-minimum / exhausted each a 400 naming its reason — wired into order
creation: `discountCode` in the payload discounts `totalPrice` (whole-taka floor, fixed
capped at subtotal), stores the `{code, type, value, amount}` snapshot on the order, and
claims usage atomically (guarded findOneAndUpdate, rolled back if the order fails after
the claim; stock rolls back if the code fails after decrement). Demoable via curl: place
an order with EID10 and watch the total drop.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Matrix tests, one per cell: valid percent (floor proven on an odd subtotal), valid fixed, fixed capped at subtotal, unknown, inactive, expired-yesterday, valid-until-tomorrow, below minimum (message names it), exhausted, case-insensitive lookup
- [x] Order with a valid code: discounted totalPrice, snapshot stored, usage consumed (proven by exhausting a limit-1 code with a second order)
- [x] Order with a rejected code: 400, no order created, stock untouched (rollback path)
- [x] Order without a code: unchanged (regression)
- [x] Fixture dates only — no sleeps, no global Date mocks
- [x] All existing tests still green; typecheck clean
