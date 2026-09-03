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

- [ ] Two-axis code review run; findings fixed or explicitly accepted
- [ ] Merged `--no-ff` to `fullstack-v2`, pushed as Sumon-59
- [ ] `CLOUDINARY_*` vars present in Render dashboard (user-confirmed)
- [ ] Probe: production `POST /api/admin/uploads/signature` → 401 without auth (proves new code deployed)
- [ ] Probe: real upload through production admin UI; image loads from `res.cloudinary.com` on the live site
- [ ] CLAUDE.md updated; spec + ticket checkboxes ticked; plan.md tracker updated
