# 07 — Utilities + config → TypeScript, strict finish line

**What to build:** The last JavaScript files (async wrapper, token helpers, DB connector)
converted — drafts from the reverted first attempt exist and can be reused; the mixed-JS
allowance switched off so the backend is 100% TypeScript; the deployment config updated so
Render builds and boots the compiled output; project docs updated to the new commands. The
slice's definition of done lands here.

**Blocked by:** 06 — Models + seed → TypeScript.

**Status:** ready-for-agent (owner: pair — Sumon converts, Claude handles deploy config)

- [ ] Backend type check passes clean with the JS allowance off
- [ ] Production build + compiled-entry boot check passes (health endpoint answers)
- [ ] Render blueprint build/start commands updated for the compiled output
- [ ] CLAUDE.md commands section reflects the new build/dev/test commands
- [ ] All 17 backend tests still green, unmodified
- [ ] Merged via /code-review per D9; plan.md tracker updated
