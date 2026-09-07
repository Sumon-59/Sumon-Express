# 03 — The Orders page: table, drawer, and legal moves only

**What to build:** The placeholder Orders page becomes the real thing. A paginated table
(newest first) shows customer, date, item count, total, and a colored status pill; a
status filter works the queue one status at a time. Clicking a row opens a detail drawer:
items with prices and quantities, shipping address and phone, payment method, customer,
totals. An actions area offers exactly the legal moves for the order's status — advance
buttons along the pipeline, cancel (with confirmation) only while pending/processing,
nothing at all on delivered/cancelled. Errors surface via the shared error helper; a
successful action refreshes the row.

**Blocked by:** 01 (the machine's rules are the actions' contract), 02 (the listing
feeds the table).

**Status:** ready-for-agent

- [ ] Table: status pills, filter, pagination wired to the new listing shape
- [ ] Drawer renders items, address, phone, payment method, customer from the row data (no extra request)
- [ ] Actions component: exactly the legal actions per status (component-tested for all five statuses)
- [ ] Cancel asks for confirmation before firing
- [ ] Errors from refused transitions shown via the shared error helper
- [ ] Manual demo in dev: drive one order pending → processing → shipped → delivered by mouse; cancel another and watch its stock come back
- [ ] All existing tests still green; frontend build green
