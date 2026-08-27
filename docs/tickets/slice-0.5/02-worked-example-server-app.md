# 02 — Worked example: server + app → TypeScript

**What to build:** The two top-of-the-graph files (the server entry and the app assembly)
converted to TypeScript as a fully narrated worked example — establishing the conversion
recipe (rename, switch to typed imports, fix compiler errors, re-run tests) that every
later ticket copies. Top-down order per the amended spec: TypeScript files may depend on
JavaScript ones, never the reverse.

**Blocked by:** 01 — TypeScript scaffolding + build pipeline.

**Status:** ready-for-agent (owner: pair — Claude narrates, Sumon follows)

- [x] Server entry and app assembly are TypeScript with no `any`
- [x] Env loading still happens before anything reads env (import order preserved)
- [x] Production start command now runs the compiled output
- [x] Type check passes; production build + compiled boot check passes
- [x] All 17 backend tests still green, unmodified
- [x] ~~Sumon states the recipe~~ (waived — D1 revised: Claude implements, Sumon reads)
