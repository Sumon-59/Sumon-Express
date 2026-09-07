# 03 — Finish line: review, merge, deploy, verify, document

**What to build:** The slice reviewed, merged, and live in production. Two-axis
code-review (Standards + Spec) with findings fixed; merge `--no-ff` into `fullstack-v2`
and push; the three Cloudinary variables confirmed present in the Render dashboard;
deploys verified with version-distinguishing probes — the new signature endpoint must
answer 401 (not 404) in production, and one real photo must upload through the production
admin UI and appear on the live storefront. CLAUDE.md gains an image-uploads section
(pattern, endpoint, env vars, folder); the spec and tickets get their boxes ticked;
plan.md's tracker marks Slice 2b done.

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] Two-axis code review run; findings fixed or explicitly accepted
- [x] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [x] `CLOUDINARY_*` vars present in Render dashboard — first save had a TRUNCATED
      secret (pasted from Cloudinary's masked display); invisible in Render logs, caught
      only by the end-to-end probe; fixed via the dashboard copy icon
- [x] Probe: production `POST /api/admin/uploads/signature` → 401 without auth (flipped from 404 on deploy)
- [x] Probe: real upload with a production-minted signature accepted by Cloudinary
      (`res.cloudinary.com/ltwhehed/.../sumon-express/products/…`)
- [x] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker updated
