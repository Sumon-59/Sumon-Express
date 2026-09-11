# 03 — Finish line: review, docs, tracker

**What to build:** two-axis review (Standards + Spec), findings fixed,
CLAUDE.md gains a "Low-stock alerts" section, plan.md tracker row updated,
merge to `fullstack-v2`, deploy, production probe.

**Blocked by:** 01, 02.

**Status:** done

- [x] Standards + Spec review run, findings addressed
- [x] CLAUDE.md doctrine section added
- [x] plan.md Slice 15 row updated with test count
- [x] Merged `--no-ff`, pushed, branch deleted
- [x] Production probe: public `/api/settings` carries `lowStockThreshold`
      live (no production admin credentials were available in this
      session to probe the admin-only survey endpoint directly — this
      public-config probe still proves the new field reached the
      deployed schema/config, not just the code)
