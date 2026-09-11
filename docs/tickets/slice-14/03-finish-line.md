# 03 — Finish line: review, merge, deploy, verify, document

**What to build:** Reviewed (threat-model axis explicit), merged, live,
documented. Probes: forgot-password's constant 200 (route absent in old
code); admin token still passes an admin-only surface (requireRole
regression); optionally a REAL production password rotation for the weak
admin password (Sumon's call — flag it). CLAUDE.md auth section updated;
boxes; tracker (diff checked).

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Two-axis code review run; findings fixed or explicitly accepted
- [ ] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [ ] Probe: forgot-password live; requireRole regression clean
- [ ] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker
      updated (diff checked)
