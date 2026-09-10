# 04 — Finish line: review, merge, deploy, verify, document

**What to build:** The slice reviewed, merged, and live. Two-axis review with findings
fixed or explicitly accepted; merge `--no-ff` to `fullstack-v2`, push as Sumon-59;
version-distinguishing probes — the customers endpoint answers 401 in production (404 on
old code) and the census renders in the production admin UI. CLAUDE.md gains the
customers/aggregation section; spec and tickets ticked; plan.md tracker marks Slice 4
done.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Two-axis code review run; findings fixed or explicitly accepted
- [ ] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [ ] Probe: production customers endpoint 404 → 401 without auth
- [ ] Probe: census visible in the production admin UI
- [ ] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker updated
