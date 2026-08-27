# 04 — Middleware → TypeScript

**What to build:** All middleware (Bearer auth, cookie auth, admin check, rate limiter,
error handler) typed, including honest types for the project's known wart: `req.user` is a
user document under cookie auth but an id string under Bearer auth. The types make the
duality explicit and safe; *fixing* it stays out of scope (Slice 1's auth refactor).

**Blocked by:** 03 — Routes → TypeScript.

**Status:** ready-for-agent (owner: Sumon, Claude reviews each middleware)

- [x] Each middleware has typed request/response/next signatures
- [x] The two `req.user` shapes are distinct named types, not `any`
- [x] The error handler's error shape (statusCode carrier) is a named type
- [x] Type check passes on the converted files
- [x] All 17 backend tests still green, unmodified
