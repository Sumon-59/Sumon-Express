# 02 — Admin products listing + the lifecycle story (backend)

**What to build:** The admin's view of the whole catalog: a guarded listing endpoint
returning products of every status with name search, status filter (active/inactive/all),
pagination, and populated category — plus the slice's centerpiece test telling the full
story: create → edit → deactivate → gone from public but present in admin list →
reactivate → public again. The backend contract is final after this.

**Blocked by:** 01 — Validation + dormant routes.

**Status:** ready-for-agent

- [x] Admin listing: 401 anonymous / 403 non-admin / 200 admin (tested)
- [x] Inactive products included; status filter and name search work (tested)
- [x] Pagination shape matches the public listing convention (tested)
- [x] Full CRUD lifecycle story test green
