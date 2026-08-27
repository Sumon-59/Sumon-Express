# 04 — Admin shell + promote-to-admin

**What to build:** The `/admin` area: sidebar layout (Dashboard, Products, Orders,
Customers, Discounts, Settings), a role guard that renders nothing until the session is
known and then redirects non-admins, placeholder pages for each section — plus a
promote-by-email script so the first admin can be created without hand-editing the
database. Demo moment: promote the dev user, log in, see the shell; a normal user gets
redirected.

**Blocked by:** 03 — Frontend interceptors.

**Status:** ready-for-agent

- [x] Admin sees the sidebar shell at /admin; all six sections navigable placeholders
- [x] Non-admin and anonymous visitors are redirected without admin content flashing
- [x] Promote script sets a user's role by email (tsx, respects current .env database)
- [x] Frontend type check, tests, and build green
