# 02 — Session + orders routes onto Bearer; retire old auth (migrate + contract)

**What to build:** The session-info endpoint and all order routes authenticate by access
token; product/category management routes move to the same middleware; the two legacy
middlewares are deleted and the `req.user` type union collapses to one shape. Refresh flow
hardened by tests: rotation kills the old cookie, logout revokes so refresh fails,
garbage/expired access tokens get 401. The backend auth contract is final after this.

**Blocked by:** 01 — Unified auth middleware.

**Status:** ready-for-agent

- [x] Session-info + orders + product/category management routes use the unified middleware
- [x] Legacy cookie-session and id-string middlewares deleted; one `req.user` type remains
- [x] Refresh rotation / logout revocation / bad-token tests green
- [x] Existing tests updated ONLY where the auth contract changed (Bearer via shared helper)
