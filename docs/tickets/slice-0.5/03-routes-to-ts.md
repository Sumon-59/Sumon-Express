# 03 — Routes → TypeScript

**What to build:** All six route files converted to TypeScript with typed routers. Routes
are the thinnest layer (import controllers + middleware, wire paths), making them the
ideal first solo conversion.

**Blocked by:** 02 — Worked example: server + app.

**Status:** ready-for-agent (owner: Sumon, Claude reviews each file)

- [x] Each route file exports a typed Router
- [x] Type check passes on the converted files
- [x] All 17 backend tests still green, unmodified
