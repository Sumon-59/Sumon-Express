# 03 — Admin products table (frontend)

**What to build:** The admin Products placeholder becomes the catalog manager's home: a
table of every product (thumbnail, name, price with discount, stock with low-stock
highlight, status pill) with a search box, status filter, pagination, and row actions —
edit link, one-click deactivate (with confirmation) and reactivate.

**Blocked by:** 02 — Admin listing endpoint.

**Status:** ready-for-agent

- [x] Table lists all statuses with search/filter/pagination wired to the admin endpoint
- [x] Deactivate asks for confirmation, then the row's status flips without a reload
- [x] Reactivate restores an inactive product from the same table
- [x] Frontend type check, tests, and build green
