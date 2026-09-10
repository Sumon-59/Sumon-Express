# 02 — Theming UI: SettingsContext, CSS-variable accent, storefront consumers, admin form

**What to build:** `SettingsContext` (fetch once, defaults while loading);
root theming wrapper setting `--accent` (+ hover shade) — pinned by ONE test;
navbar/hero/footer read settings; `AnnouncementBar` renders only when
non-empty; accent-colored elements move to `var(--accent)` arbitrary-value
classes; `/admin/settings` form with live preview card and color picker;
logo/hero uploads reuse `lib/uploads.ts`.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] SettingsContext + root `--accent` variable (test green)
- [ ] Navbar, hero, announcement bar, footer render from settings
- [ ] Hardcoded orange accents replaced with the variable
- [ ] Admin Settings form + live preview + color input; saves via PUT
