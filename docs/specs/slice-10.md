# Slice 10 — Store settings & theming (mini theme editor)

Status: ready-for-agent
Branch: `slice-10-settings`
Seam decision (full-autonomy contract): backend HTTP seam for the singleton
lifecycle and validation; theming is rendering — browser-checked, plus ONE
frontend test pinning the CSS-variable application (the mechanism, not the look).

## Problem Statement

The storefront's identity is hardcoded: the name in the navbar, the hero copy,
the accent color scattered as Tailwind orange classes, the footer text. Rebranding
means editing code and redeploying. The store owner — not a developer — should be
able to change what the shop looks like from the admin panel.

## Solution

A **singleton** `StoreSettings` document drives the storefront's brand: store
name, logo, accent color, hero headline/subtitle/image, announcement bar, footer
text. Admins edit it on a Settings page with a live preview; the storefront
(navbar, hero, announcement bar, footer) renders from it. The accent color
becomes a **CSS variable** set once at the app root — components reference the
variable, so one write recolors every accent on the site. "Done" = the storefront
can be rebranded without touching code.

## User Stories

1. As the store owner, I want to change the store name, logo, hero, announcement and footer from the admin panel, so that rebranding needs no developer.
2. As the store owner, I want to pick an accent color and see the storefront adopt it everywhere, so that the brand is consistent.
3. As the store owner, I want a live preview beside the form, so that I see the result before saving.
4. As a shopper, I want the storefront to show the configured brand (and sensible defaults before any configuration), so that the site never looks broken.
5. As the store owner, I want the announcement bar to appear only when I've written one, so that an empty bar never renders.
6. As a developer, I want exactly one settings document no matter how many writes race, so that "the settings" is always a single answer.
7. As a developer, I want invalid values (a non-color accent, an overlong name) refused with named 400s, so that the storefront can trust what it reads.

## Implementation Decisions

- **The singleton pattern**: `StoreSettings` has NO meaningful query key — the
  document IS the collection. Reads and writes both go through
  `findOneAndUpdate({}, …, {upsert: true, new: true, setDefaultsOnInsert: true})`
  — the empty filter `{}` plus upsert means the first touch creates it and every
  later touch finds it; concurrent first-writes cannot create two (the upsert
  race resolves to one document; a unique index is unnecessary because there is
  no key to collide on — Mongo serializes the upsert on the same `{}` match).
  Contrast with everything we've built: this is the first model where "which
  document?" has exactly one answer by design.
- **Fields** (all strings unless noted): `storeName`, `logoUrl`, `accentColor`
  (hex), `heroHeadline`, `heroSubtitle`, `heroImageUrl`, `announcement`
  (empty = no bar), `footerText`. Defaults reproduce today's hardcoded brand
  (name "Sumon Express", accent `#ea580c`, current hero copy) so a fresh
  database renders the same storefront as before this slice.
- **`validateSettingsData` is THE choke point** (the product/discount pattern):
  every field optional (partial update), strings trimmed; `accentColor` must
  match `#rgb`/`#rrggbb` (case-insensitive, stored lowercase) — a named 400
  otherwise; `storeName` non-empty when present, ≤ 60 chars; text fields capped
  (headline 120, subtitle/announcement/footer 300); URL fields must parse as
  http(s) URLs when non-empty (empty string clears them). Add settings rules
  there, nowhere else.
- **Endpoints**: `GET /api/settings` — PUBLIC (the storefront reads it before
  any auth exists; nothing secret lives here) — answers the singleton, creating
  it with defaults on first read. `PUT /api/admin/settings`
  (requireAuth + requireAdmin) — partial merge: only sent fields change (the
  product-update convention). No DELETE — settings can be edited back, never
  removed.
- **Frontend theming — the CSS-variable mechanism** (`/teach` topic): the app
  root sets `--accent` (and a derived `--accent-dark` for hover) as inline
  style from settings; accent-colored elements use `bg-[var(--accent)]` /
  `text-[var(--accent)]` arbitrary-value classes instead of hardcoded orange
  utilities. One variable write recolors navbar links, buttons, badges, prices.
  A `SettingsContext` (the AuthContext pattern) fetches once, exposes
  `{settings, loading}`, and serves the same defaults as the backend while
  loading — no flash of unbranded content, no layout shift.
- **Storefront consumers**: navbar (name/logo), home hero (headline/subtitle/
  image), announcement bar (renders only when non-empty — a new thin
  component), footer (text). Admin: `/admin/settings` form with a live preview
  card (navbar + hero + button mock driven by the DRAFT values, not the saved
  ones) and an accent color input (`<input type="color">` + hex text field).
- Logo/hero images: paste a URL or upload via the EXISTING Slice 2b signed
  upload helper (`lib/uploads.ts`) — nothing new server-side.

## Testing Decisions

- **Backend (Supertest):**
  - singleton lifecycle: first GET answers defaults (and creates the doc);
    PUT then GET reflects the change; a SECOND PUT changing one field leaves
    the others intact (partial merge); the collection holds exactly ONE
    document after GET + two PUTs (the singleton pin);
  - validation matrix: bad accent (`red`, `#12345`, `ea580c`) → named 400;
    good `#EA580C` stored lowercase; overlong storeName/headline → named 400;
    empty storeName → 400; non-URL logoUrl → 400; empty-string logoUrl
    accepted (clears);
  - auth: PUT anonymous 401, non-admin 403; GET needs no auth;
  - defaults are complete: every documented field present on first GET.
- **Frontend**: one test — the root theming wrapper sets `--accent` from
  settings (mock context; assert the style property). Rendering (navbar, hero,
  preview) browser-checked per the seam decision.
- Deploy probe: `GET /api/settings` answers the defaults document in
  production (route absent in old code = version-distinguishing), then an
  authenticated write probe: PUT a scratch `announcement`, GET reflects it,
  PUT it back to empty — the full owner journey against real credentials.

## Out of Scope

- Multiple themes, dark-mode toggle, font pickers, full page builders.
- Per-page/per-section theming; more than one accent color.
- Settings history/versioning/audit log.
- Currency, locale, tax, shipping configuration (later slices).
- Server-side rendering of settings (the storefront is client-rendered today;
  SSR/meta-tag branding is a future concern).

## Further Notes

- Why public GET: the navbar renders for anonymous shoppers; gating settings
  behind auth would leave the brand blank exactly where it matters most.
- Why partial merge on PUT: the form usually saves everything, but partial
  semantics mean a future field addition can't be wiped by an old client — the
  same reasoning as product updates.
- The accent CSS variable is the whole theming trick: Tailwind's arbitrary
  values (`bg-[var(--accent)]`) let utility classes read a runtime value —
  compile-time classes, runtime color.
