# 02 — Theming UI: SettingsContext, CSS-variable accent, storefront consumers, admin form

**What to build:** `SettingsContext` (fetch once, defaults while loading);
root theming via the EXISTING `--primary` token (as-built amendment: no new
variable — shadcn utilities already resolve to it) — pinned by ONE test;
navbar/hero/footer read settings; `AnnouncementBar` renders only when
non-empty; remaining hardcoded oranges move onto the token; `/admin/settings` form with live preview card and color picker;
logo/hero uploads reuse `lib/uploads.ts`.

**Blocked by:** 01.

**Status:** done

- [x] SettingsContext + root `--primary` override (test green)
- [x] Navbar, hero, announcement bar, footer render from settings
- [x] Hardcoded orange accents replaced with the variable
- [x] Admin Settings form + live preview + color input; saves via PUT
