# 03 — Finish line: review, merge, deploy, verify, document

**What to build:** Reviewed (grill the trust boundary hard), merged, live,
documented. Probes: `/api/payments/init` route exists in production (absent
in old code); when SSLCommerz sandbox credentials land in Render (Sumon's
registration — the external dependency), a real init answers a live
sandbox.sslcommerz.com URL and a gateway test payment marks an order paid
via the verified IPN. CLAUDE.md payments section; boxes; tracker (diff
checked).

**Blocked by:** 02.

**Status:** done (two items parked, see boxes)

- [x] Two-axis code review run; findings fixed (incl. the cross-transaction replay)
- [x] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [x] Probe: init/IPN/redirect routes live in production (named responses
      prove new code). PARKED: the credentialed gateway probe awaits Sumon's
      SSLCommerz sandbox registration; the redirect-host fix (87baca5/01ebd71)
      is pushed but Render stopped auto-deploying after 02:01 — needs a
      dashboard look (or set CLIENT_URL there, which fixes it regardless)
- [x] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker
      updated (diff checked)
