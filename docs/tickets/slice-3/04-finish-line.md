# 04 — Finish line: review, merge, deploy, verify, document

**What to build:** The slice reviewed, merged, and live. Two-axis code review with
findings fixed or explicitly accepted; merge `--no-ff` into `fullstack-v2`, push as
Sumon-59; deploys verified with version-distinguishing probes — the admin orders listing
answering the `{orders, total, page, pages}` wrapper (old code answers a bare array)
proves the backend, one real status advance through the production admin UI proves the
whole chain. CLAUDE.md's orders section updated to describe the state machine; spec and
ticket boxes ticked; plan.md tracker marks Slice 3 done.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Two-axis code review run; findings fixed or explicitly accepted
- [ ] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [ ] Probe: production admin orders listing answers the wrapper shape (not a bare array)
- [ ] Probe: one real status advance in the production admin UI
- [ ] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker updated
