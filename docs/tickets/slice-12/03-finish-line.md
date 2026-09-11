# 03 — Finish line: review, merge, deploy, verify, document

**What to build:** Reviewed, merged, live, documented. Probes:
`shippingMethods` present in the production settings payload (absent in old
code); the unknown-shipping-key named 400 (proves the pricing path);
settings fee-edit round-trip, restored. NOTE: Render deploys were stalled at
slice close — these probes double as the resumed-deploys signal; park
explicitly if still stalled. CLAUDE.md shipping/timeline section; boxes;
tracker (diff checked).

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Two-axis code review run; findings fixed or explicitly accepted
- [ ] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [ ] Probe: shippingMethods live + named-400 pricing seam (or parked on
      the Render stall with the watch running)
- [ ] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker
      updated (diff checked)
