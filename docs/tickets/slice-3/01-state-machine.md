# 01 — The status pipeline becomes an enforced state machine

**What to build:** An admin driving an order through its life can only make legal moves.
Forward moves along pending → processing → shipped → delivered succeed (skips included,
e.g. pending → shipped); every backwards move is refused with a 400 naming the rule.
Delivered and cancelled orders are immutable. The generic status route refuses
`cancelled` and `pending` as targets outright — cancellation has exactly one door, the
cancel endpoint, because it is the only code that restores stock. Admin cancel works from
pending/processing only, restores every item's stock, and stamps who/when. Reaching
delivered still marks the order paid.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Happy pipeline tested: pending → processing → shipped → delivered, and pending → shipped skip
- [ ] Backwards moves refused with 400 (e.g. shipped → processing)
- [ ] Updates on delivered and on cancelled orders refused with 400 (both routes)
- [ ] `status: "cancelled"` and `status: "pending"` refused by the status route with 400
- [ ] Unknown status refused with 400 naming the valid set
- [ ] Delivered sets `isPaid` and `paidAt`
- [ ] Admin cancel from pending and from processing restores stock (asserted via public product API)
- [ ] Admin cancel on a shipped order refused with 400
- [ ] All refusals answer with a message naming the rule
- [ ] All existing tests still green; typecheck clean
