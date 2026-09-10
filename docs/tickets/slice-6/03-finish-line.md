# 03 — Finish line: review, merge, deploy, verify, document

**What to build:** The slice reviewed, merged, live, documented. Two-axis review with
findings fixed or explicitly accepted; merge `--no-ff`, push as Sumon-59; probes — the
analytics endpoint 404 → 401 in production, then an authenticated read returning
believable totals over real production data. CLAUDE.md analytics section; spec +
tickets ticked; plan.md tracker updated.

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] Two-axis code review run; findings fixed or explicitly accepted
- [x] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [x] Probe: production analytics endpoint 404 → 401 without auth
- [x] Probe: authenticated (4 pending orders ৳25,594, 0 realized — honest; empty topProducts = the pre-Slice-0 no-items orders, a true artifact) production read with believable totals
- [x] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker updated
