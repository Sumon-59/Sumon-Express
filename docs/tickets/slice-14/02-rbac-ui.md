# 02 — RBAC + UI: staff role, one permission door, auth pages

**What to build:** `requireRole` generalizing requireAdmin (same export);
staff|admin on admin ORDERS routes only — the permission map lives in
admin.routes.ts; role route (closed set user/staff, no self-demotion,
admin-only); frontend: /forgot-password, /reset-password, /account
(change password), navbar entry, role-filtered admin nav + layout guard,
role select on customer detail. TDD the RBAC matrix.

**Blocked by:** 01.

**Status:** done

- [x] requireRole; orders accept staff; everything else admin-only (matrix)
- [x] Role route: closed set, self-demotion 400, staff refused
- [x] Auth pages + account page + staff-aware admin nav (browser-checked)
- [x] Existing auth suite untouched and green
