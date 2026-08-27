# 01 — TypeScript scaffolding + build pipeline

**What to build:** The backend gains the machinery to be a TypeScript project while all
existing code is still JavaScript: the compiler and type definitions installed, a strict
compiler config that tolerates mixed JS/TS during the migration, a production build that
emits a runnable output directory, and a dev watch command replacing nodemon. Nothing is
converted yet — this ticket proves the pipeline end to end before any source changes.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent (owner: Claude, approved scaffolding)

- [ ] Production build command compiles the backend successfully
- [ ] The compiled entry boots and answers the health endpoint
- [ ] Dev watch command starts the server and reloads on change
- [ ] All 17 backend tests still green, unmodified
- [ ] Build output directory is gitignored
