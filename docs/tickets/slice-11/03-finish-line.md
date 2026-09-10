# 03 — Finish line: review, merge, deploy, verify, document

**What to build:** Reviewed (grill the trust boundary hard), merged, live,
documented. Probes: `/api/payments/init` route exists in production (absent
in old code); when SSLCommerz sandbox credentials land in Render (Sumon's
registration — the external dependency), a real init answers a live
sandbox.sslcommerz.com URL and a gateway test payment marks an order paid
via the verified IPN. CLAUDE.md payments section; boxes; tracker (diff
checked).

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Two-axis code review run; findings fixed or explicitly accepted
- [ ] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [ ] Probe: payments routes live in production; credentialed gateway probe
      run (or explicitly parked on the sandbox-registration dependency)
- [ ] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker
      updated (diff checked)
