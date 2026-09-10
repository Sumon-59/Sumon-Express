# 03 — Finish line: review, merge, deploy, verify, document

**What to build:** Reviewed, merged, live, documented. Two-axis review; merge
`--no-ff`, push as Sumon-59; probe — create a variant product against production via
the API (a version-distinguishing WRITE: old code drops the fields, new code persists
and serves them), verify the public product answers the axis, then clean up or keep
as a real catalog item. CLAUDE.md variants section; boxes ticked; tracker updated.

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] Two-axis code review run; findings fixed or explicitly accepted
- [x] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [x] Probe: variant product (Probe Tee S/M created in production, axis + computed sum 5 served back publicly, then soft-deleted) created in production; public API serves the axis
- [x] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker updated
