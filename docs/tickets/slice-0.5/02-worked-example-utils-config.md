# 02 — Worked example: utilities + config → TypeScript

**What to build:** The smallest leaf modules (the async error wrapper, the token
generators, the database connector) converted to TypeScript together as a fully narrated
worked example — establishing the conversion recipe (rename, add types, fix compiler
errors, re-run tests) that every later ticket copies.

**Blocked by:** 01 — TypeScript scaffolding + build pipeline.

**Status:** ready-for-agent (owner: pair — Claude narrates, Sumon follows)

- [ ] Converted modules have explicit parameter and return types (no `any`)
- [ ] Type check passes on the converted files
- [ ] All 17 backend tests still green, unmodified
- [ ] Sumon can state the conversion recipe in his own words
