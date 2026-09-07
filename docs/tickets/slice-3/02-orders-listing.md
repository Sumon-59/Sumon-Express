# 02 — The admin orders listing grows up

**What to build:** An admin browsing orders can filter by status and page through
results. The admin listing answers `{orders, total, page, pages}` — the same wrapper the
admin products listing uses — sorted newest-first, each row carrying the populated
customer (name, email) and the embedded items snapshot, so a detail view needs no second
request. `status` takes any one pipeline status (omitted = all); `page`/`limit` behave
exactly like the products listing.

**Blocked by:** None — can start immediately (independent of 01).

**Status:** ready-for-agent

- [x] Response shape `{orders, total, page, pages}`; bare-array shape gone
- [x] `status` filter returns only matching orders; omitted returns all
- [x] Invalid `status` value refused with 400
- [x] Pagination math tested: `total`/`pages` correct, page 2 returns the next set
- [x] Newest-first ordering tested
- [x] Rows carry populated customer name/email and full items snapshot
- [x] 401 anonymous / 403 non-admin
- [x] All existing tests still green; typecheck clean
