# 02 — The customers API: census, detail, and the user filter

**What to build:** An admin with curl can answer "who are my best customers?". The
census listing returns every role-user customer with three database-computed columns —
orders placed, lifetime spend, last order date — cancelled orders counting for nothing,
zero-order customers showing 0 / 0 / null, admins absent, spend-descending by default,
`sort=newest` for signups, unknown sorts 400, paginated with the standard wrapper via
ticket 01's helper. The customer detail endpoint answers one customer's identity and the
same numbers (404 for unknown ids). The existing admin orders listing gains a `user`
filter (invalid ids 400) so a customer's order history is one query away. All three
admin-gated like every sibling.

**Blocked by:** 01 — the census is the pagination helper's third consumer.

**Status:** ready-for-agent

- [x] Census over known fixtures: exact orderCount / totalSpent / lastOrderAt per row (multi-order customer included — the $lookup multiply-count trap)
- [x] Zero-order customer present with 0 / 0 / null
- [x] Cancelling an order through the API changes no computed column
- [x] Default sort spend-descending; `sort=newest` by join date; unknown sort 400
- [x] Admin accounts absent from the census
- [x] Pagination wrapper + math; 401/403 on both new endpoints
- [x] Detail: correct numbers; 404 unknown id
- [x] Orders listing `user` filter: only that customer's orders; invalid id 400
- [x] All existing tests still green; typecheck clean
