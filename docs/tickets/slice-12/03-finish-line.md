# 03 — Finish line: review, merge, deploy, verify, document

**What to build:** Reviewed, merged, live, documented. Probes:
`shippingMethods` present in the production settings payload (absent in old
code); the unknown-shipping-key named 400 (proves the pricing path);
settings fee-edit round-trip, restored. NOTE: Render deploys were stalled at
slice close — these probes double as the resumed-deploys signal; park
explicitly if still stalled. CLAUDE.md shipping/timeline section; boxes;
tracker (diff checked).

**Blocked by:** 02.

**Status:** done

- [x] Two-axis code review run; findings fixed (drawer Delivery row, deploy-window settings merge, Bangla-label slug fallback, true one-door seed)
- [x] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [x] Probe: Render deploys RESUMED; shippingMethods live, unknown-key
      named 400 verified, fee-edit round-trip 60→70→60 clean. Bonus: probes
      traced Slice 11's localhost redirects to CLIENT_URL=localhost set in
      the Render dashboard — code now refuses localhost on a deployed
      platform (bfda71c)
- [x] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker
      updated (diff checked)
