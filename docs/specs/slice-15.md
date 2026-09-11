# Slice 15 — Low-stock alerts

Status: in progress
Branch: `slice-15-low-stock-alerts`
Seam decision (full-autonomy contract): backend HTTP seam for the alerting
matrix (threshold validation, edge-triggered detection, the mail fake reads
the emails, the low-stock listing endpoint); admin frontend (settings field,
dashboard panel) browser-checked, no new component tests (thin read/display
surfaces, same seam decision as Slice 14's account pages).

## Problem Statement

Stock silently runs out. Nothing in the app tells the store owner a product
is about to sell out until an order fails with "insufficient stock" — by
which point a sale was already lost. There is also no way to *survey*
current stock levels at a glance; the owner would have to scroll the full
product table checking numbers by eye.

## Solution

A global, admin-configurable low-stock threshold on the settings singleton
(default 5; 0 explicitly disables the feature). Two surfaces read it:

1. **Edge-triggered email alerts** — when an order's stock claim drops a
   product (or a variant value) from *above* the threshold to *at or below*
   it, every admin gets one email. Alerts are edge-triggered, not
   level-triggered: once a line is already at or below the threshold,
   further orders against it (or the settings admin simply raising the
   threshold) do not re-fire — the point is to catch the moment stock
   *becomes* a problem, not to nag on every subsequent sale.
2. **A live low-stock list** — an admin-only endpoint and dashboard panel
   showing everything currently at or below the threshold. This is the
   survey surface: a product created already below threshold, or one that
   crossed before the alert email existed, or one that crossed a threshold
   that was only just lowered, all still show up here even though no email
   ever fired for them.

## User Stories

1. As the store owner, I want to set a threshold below which stock counts
   as "low," so that "low" means what I want it to mean for my catalog.
2. As the store owner, I want an email the moment a product/variant drops
   to or below that threshold, so that I can reorder before it sells out.
3. As the store owner, I do NOT want a fresh email for every order after
   the first one that crossed the line — that's noise, not signal.
4. As the store owner, I want a dashboard view of everything currently low,
   so I don't have to wait for an email to know where I stand.
5. As a developer, I want the alert to use the SAME stock engine that
   Slice 7 already established as the one door for stock math — never a
   second, hand-rolled decrement path.
6. As a developer, I want a false alarm impossible: if an order's stock
   claim is later rolled back (a downstream step fails), no alert for it
   should have gone out.

## Implementation Decisions

- **`StoreSettings.lowStockThreshold`**: integer, default 5, validated in
  the existing `validateSettingsData` choke point (whole number, 0–10000;
  0 is the explicit "disabled" value — not a magic sentinel, a documented
  one). Read via the existing `readStoreSettings()` shared helper — no new
  settings-read path.
- **Detection lives in the existing stock engine, not beside it**:
  `claimItemStock` (`utils/orderItems.ts`) already IS the one door for
  every stock decrement (order creation, and by extension anything built
  on it). Its return type changes from `Promise<boolean>` to
  `Promise<{claimed: boolean; stock?: number}>` — `stock` is the
  POST-claim count of the specific unit that moved (the variant value's
  stock for a variant line, the top-level `stock` for a plain product;
  never the aggregate sum on a variant product — that's not what gets
  restocked). This is the only call-site change (one caller:
  `createOrder`).
- **Edge detection happens in `createOrder`**, using the `stock` the claim
  already returns plus the item's own `quantity` (pre-claim stock =
  `stock + quantity` — no second read): a crossing is recorded when
  `threshold > 0 && stock <= threshold && stock + quantity > threshold`.
  Crossings accumulate in a local array across the claim loop.
- **Alerts fire only after the order is actually committed.** The claim
  loop runs before the discount claim and before `order.save()`; either
  can still fail and trigger `restoreOrderStock` (undoing the very
  decrement that produced the crossing). The collected crossings are
  therefore only ever handed to the mailer AFTER `order.save()` succeeds,
  alongside the existing `notifyOrderPlaced` call — never inside the claim
  loop itself.
- **One email per order, not one per line**: `notifyLowStock(crossings,
  adminEmails)` (new file `mail/inventoryEmails.ts`, same `dispatch()`
  door as every other mail trigger) batches every crossing from one
  order into a single email per admin — a big order that empties three
  products sends three admins one email each, not nine. No-op on an
  empty crossings array (the common case — most orders cross nothing).
- **Recipients are looked up, not configured**: every `User` with
  `role: "admin"` gets the email — no separate "alert email" setting to
  keep in sync with who's actually an admin. Staff are excluded (RBAC
  precedent: inventory and settings are the admin-only side of the
  Slice 14 permission split, same as everything but orders). The lookup
  is an AWAITED inline DB read in `createOrder`, mirroring the existing
  `buyerEmail` helper in `adminOrder.controller.ts` (the established
  precedent: a recipient lookup is a DB read like any other in these
  handlers, not "mail" — only the SEND is fire-and-forget). This also
  sidesteps a real gotcha found during TDD: an unawaited `.then()`-based
  lookup inside the notify function raced the HTTP response in tests
  (and, more importantly, offered no guarantee the alert dispatch even
  starts before the process could move on) — resolving emails in the
  controller keeps `notifyLowStock` exactly as synchronous and
  throw-proof as `notifyOrderPlaced`/`notifyStatusChange`.
- **The survey endpoint**: `GET /api/admin/products/low-stock` (admin-only)
  returns `{threshold, items: [{productId, name, variantName?, stock}]}`,
  sorted ascending by stock (most urgent first). Plain products contribute
  one row when `stock <= threshold`; variant products contribute one row
  PER variant value at or below threshold (never a product-level row for
  variant products — the restockable unit is the value, not the sum).
  Only ACTIVE products are surveyed (soft-deleted products, same as
  everywhere else in the catalog, don't need restocking). `threshold <= 0`
  short-circuits to `{threshold: 0, items: []}` — the disabled state is
  unambiguous, not "empty because nothing's low."
  **Route-ordering gotcha**: this route must be registered BEFORE the
  existing `/admin/products/:id`, or Express's param route would swallow
  `/admin/products/low-stock` as `:id = "low-stock"`.
  **Review fix**: the query originally re-derived "does this product have
  an option axis" as a SECOND, separately-maintained rule inside the Mongo
  filter (`optionName: {$exists:false}` alongside the variants clause) —
  which could silently disagree with the one true definition (the
  in-memory `hasAxis` check `buildOrderItems` also uses) for a corrupted
  document with `optionName` set but no variant values. The query is now
  a plain superset — `stock <= threshold OR variants.stock <= threshold`
  — with `hasAxis` staying the ONLY place that decides row shape.
- **Frontend**: a "Low-stock threshold" number field on the existing admin
  settings form (same `draft`/`set` pattern as every other field; 0 =
  disabled, labeled as such). A "Low stock" panel on the admin dashboard,
  fetching the new endpoint, listing product+variant/stock pairs linking
  to the product's edit page, with distinct empty states for "disabled"
  (threshold 0) vs. "nothing low right now" (threshold set, list empty).
- **Explicitly NOT triggered by manual stock edits.** Editing a product's
  stock number directly in the admin product form does not fire an alert
  — the admin just typed that number, they already know it. The alert
  exists to catch stock disappearing through ORDER activity, which is the
  thing that can happen without anyone watching.

## Testing Decisions

- **Backend (Supertest + the mail fake):**
  - `validateSettingsData`: threshold accepts 0 and positive integers up
    to 10000; rejects negative, non-integer, and out-of-range values
    (named 400); omitted in a PUT leaves the stored value untouched
    (partial-merge convention).
  - `claimItemStock`'s new return shape has no dedicated unit test — this
    project's tests assert only through the public HTTP seam (see
    CLAUDE.md's testing conventions), and the shape has no independent
    HTTP-observable behavior of its own beyond what the alert/order tests
    below already cover: a successful claim's `stock` value is verified
    indirectly, by asserting the exact remaining count named in the
    resulting alert email (including landing exactly on the threshold,
    below); the insufficient-claim branch never reads `stock` at all (the
    controller throws before touching it), so "no `stock` key" is a
    TypeScript-enforced contract, not a runtime assertion, and the 400
    itself is already covered by the pre-existing stock/variant test
    files.
  - Order creation: a claim that drops a plain product from above to at/
    below threshold sends exactly one admin email naming the product and
    remaining count; the same claim landing EXACTLY on the threshold (the
    tightest edge the crossing formula implies) still alerts; a claim
    that drops it from below to further-below sends nothing
    (edge-triggered, not level-triggered); a variant claim crossing the
    threshold names the variant AND its own remaining count, not just the
    product; an order crossing two lines sends ONE email per admin, not
    two, and EACH admin's copy is checked for both items' content (not
    just one admin's); a staff or plain user account gets nothing and the
    recipient set is exactly the admins, no more, no less; `lowStockThreshold: 0`
    sends nothing regardless of resulting stock.
  - Rollback correctness — TWO distinct scenarios, not one: (1) a code
    already at its usage limit refuses BEFORE the claim loop even runs
    (nothing was ever claimed, so nothing to roll back — the cheap-refusal
    path); (2) a claim that DOES cross the threshold, on an order whose
    `order.save()` then fails for an unrelated reason (the Slice 5
    malformed-phone-object lever, reused), exercising the genuine
    claimed-then-restored path via `restoreOrderStock`. Only scenario (2)
    is the one User Story 6 is actually about — an earlier draft of this
    test used the usage-limit lever alone, which turned out to always
    take path (1) and therefore never touched the claim loop at all
    (review finding: a passing-but-vacuous test). Both are now separate,
    named tests.
  - `GET /api/admin/products/low-stock`: returns plain products at/below
    threshold, one row per low variant value (not a product-level row)
    for variant products, sorted ascending by stock, admin-only (staff
    and user 403/401), threshold 0 returns an empty list with
    `threshold: 0` rather than 400 or crashing.
  - Regression: the full existing order-creation suite (stock, discounts,
    shipping) stays green with the new `claimItemStock` return shape.
- **Frontend**: browser-checked (settings field round-trips; dashboard
  panel renders both empty states and a populated list) — no new
  component tests, matching the Slice 14 thin-surface precedent.
- **Deploy probe**: `GET /api/admin/products/low-stock` answers live with
  the admin token (shape + threshold), proving the route survived the
  `:id`-shadowing gotcha in production, not just in the dev router.

## Out of Scope

- Per-product threshold overrides (global-only, like every other settings
  value on the singleton; revisit if the catalog grows varied enough for
  one number to stop making sense).
- SMS/push alerts, a digest/summary schedule (daily rollup instead of
  per-order), alert snoozing.
- Firing alerts from admin manual stock edits (see Implementation
  Decisions — a deliberate exclusion, not an oversight).
- Automatic reordering, supplier integration, or any inventory action
  beyond "tell a human."

## Further Notes

- This is Slice 15, the plan's explicit "stretch — pick by appetite" slot
  (multi-currency display, wishlist, low-stock alerts, second payment
  provider). Low-stock alerts were picked because they need no new
  external account/dependency and reuse two doctrines wholesale: the
  Slice 7 stock engine (one door) and the Slice 13 mail engine
  (fire-and-forget, throw-proof dispatch).
- The edge-triggered design mirrors why `recordStatus`/history and the
  singleton settings pattern exist elsewhere in this codebase: computed
  once, at the moment of a real transition, not re-derived or re-fired on
  every read.
- **Review findings, both fixed**: (1) the rollback test was vacuous — it
  used a discount-usage-limit lever that refuses BEFORE the stock claim
  loop runs, so it never actually exercised a rollback; replaced with a
  genuine claimed-then-restored test using the Slice 5 malformed-phone
  lever, and the vacuous case kept as its own, honestly-named "refused
  before any claim" test. (2) the survey endpoint's Mongo filter
  duplicated the option-axis check as a second, divergence-prone rule;
  simplified to a plain superset filter with `hasAxis` as the one
  definition. The frontend Low Stock panel also gained its own error
  state (it previously showed the loading skeleton forever on a fetch
  failure, unlike the sibling analytics panels on the same page).
