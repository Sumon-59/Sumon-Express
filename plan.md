# Sumon Express → Shopify-class Commerce Platform

A vertical-slice implementation plan for evolving Sumon Express from a single-store shop
into a Shopify-inspired commerce platform — built **slice by slice: spec → grill → tickets →
TDD → implement → review**, with learning as the primary goal.

> **Honest scoping note.** Shopify is a multi-tenant SaaS store *builder*. We are cloning its
> **feature architecture and workflows** (merchant admin, products, orders, customers,
> discounts, analytics, storefront, checkout), not its brand, copy, or visual assets — those
> are Shopify's property, and copying them would also teach us nothing. Every slice below is
> a real Shopify capability re-imagined for our stack.

---

## 1. Reference exploration: what Shopify actually is

Explored `shopify.com/online` + feature pages. Functionally, Shopify is two applications
sharing one data model:

**A. Merchant Admin (the heart of the product)**
- Products: unlimited catalog, variants (size/color), collections, multi-image, barcodes,
  inventory tracking per location, activate/deactivate
- Orders: status pipeline, draft orders, returns/cancellations, notes, receipts, tax
- Customers: profiles, purchase history, lifetime value, segments, marketing opt-in
- Discounts: codes, automatic discounts, performance tracking
- Analytics: sales dashboards, top products, finance reports
- Staff: roles and permissions, approval workflows
- Settings/Theming: store identity, 800+ themes, visual page editor

**B. Storefront (what shoppers see)**
- Themed store: hero, collections, product grid, search + filtering, recommendations
- Product page: image gallery, variant picker, stock state
- Cart → "world's best-converting checkout": address, shipping options, payment
  (Shopify Payments built in), multi-currency
- Post-purchase: order status page, email notifications

**What we already have** (v2, deployed): cookie auth, product catalog with categories +
search/filter/sort/pagination, cart (localStorage), COD checkout with shipping address,
order history + cancellation with stock rollback, admin API (Bearer) without any UI, and a
Daraz-style storefront. **No automated tests yet** — that's the first thing to fix, because
every slice after it is built test-first.

---

## 2. How we work: the slice loop and the skill toolbox

Every slice follows the same loop. **The skill to invoke is named at each step** — this is
the learning engine of the project:

| Step | What happens | Skill |
|------|--------------|-------|
| 1. Spec | Discuss the slice, then turn the conversation into a written spec | `/to-spec` |
| 2. Grill | Stress-test the spec relentlessly before writing code | `/grill-me` |
| 3. Tickets | Break the spec into tracer-bullet tickets with dependencies | `/to-tickets` |
| 4. Build | Red-green-refactor each ticket test-first | `/tdd` |
| 5. Execute | Implement well-specified tickets | `/implement` |
| 6. Verify | Manual pass through the acceptance criteria, then deploy |
| 7. Reflect | Review architecture after the slice lands | `/improve-codebase-architecture` |

**Situational skills — reach for these whenever the moment calls:**

| Situation | Skill |
|-----------|-------|
| Something is broken, throwing, failing, or slow | `/diagnosing-bugs` |
| Planning a chunk too big for one session (e.g. a whole phase) | `/wayfinder` |
| Ending a session mid-slice; next session needs context | `/handoff` |
| You want to *understand* a concept we just used (JWT, indexes, React state…) | `/teach` |
| A decision needs your input and Claude can't answer it alone | `/to-questionnaire` |
| Claude's last explanation didn't land — demand a re-pitch | `/wait-what` |

> All 12 skills are installed in `~/.claude/skills`. Newly installed ones load when a new
> Claude Code session starts.

**Definition of done for every slice:** tests green (`npm test`), types green
(`npx tsc --noEmit`), build green (`npm run build`), acceptance criteria pass manually,
deployed to Render + Vercel, and you can explain how it works (use `/teach` if not).

---

## 3. The slices

### Phase 0 — Foundation

#### Slice 0: Test infrastructure ⬅ START HERE
Shopify ships nothing untested; neither will we. Everything after this slice is TDD.
- **Backend:** Vitest + Supertest + `mongodb-memory-server` (tests never touch Atlas — this
  also fixes the current danger that local tests write to the production DB). Refactor
  `server.js` to export the Express `app` separately from `listen()` so Supertest can mount it.
  First integration tests: auth register/login/me/logout, product listing, order lifecycle.
- **Frontend:** Vitest + React Testing Library. First tests: CartContext (add/remove/qty/total).
- **Done when:** `npm test` runs green in both apps; the order-lifecycle test would have
  caught the "orders saved with no items" bug we fixed in v2.
- **Skills:** `/tdd` (this slice *is* the skill's setup step), `/teach` for "how do
  integration tests with an in-memory Mongo work?"

---

### Phase 1 — Merchant Admin (Shopify's core)

#### Slice 1: Admin foundation — login, layout, guard
- **Backend:** unify admin auth onto the cookie mechanism (`protectCookie` + role check) so
  the browser admin works without juggling Bearer tokens; promote-to-admin script.
- **Frontend:** `/admin` area with sidebar layout (Dashboard, Products, Orders, Customers,
  Discounts, Settings), route guard (admins only), empty pages.
- **Done when:** an admin can log in and see the shell; a normal user is redirected.
- **Skills:** `/to-spec` → `/grill-me` (grill the auth unification decision — it has real
  trade-offs) → `/tdd`.

#### Slice 2: Product management
- **Backend:** enable the commented-out update/delete routes, image URLs array, validation;
  tests for create/update/soft-delete/reactivate.
- **Frontend:** product table (search, status filter), create/edit form (name, description,
  price, discount price, stock, category, images), deactivate/activate toggle.
- **Done when:** you can run the store's whole catalog from the browser — no more Postman.
- **Skills:** `/to-tickets` (this slice splits naturally: API → table → form), `/implement`,
  `/tdd`.

#### Slice 3: Order management
- **Backend:** admin order endpoints exist — add pagination + status filtering + tests for
  the status pipeline rules (no updates after delivered/cancelled, stock restore on cancel).
- **Frontend:** orders table with status pills and filters, order detail drawer (items,
  address, customer), status transition buttons, cancel with confirmation.
- **Done when:** the full pending → processing → shipped → delivered pipeline is drivable
  from the UI, and cancellation restores stock.
- **Skills:** `/tdd` (the pipeline rules are a textbook state-machine test target),
  `/teach` for "state machines in business logic".

#### Slice 4: Customers
- **Backend:** `GET /api/admin/customers` — list users with aggregated order count, total
  spent (lifetime value), last order date (MongoDB aggregation pipeline).
- **Frontend:** customers table, customer detail page with order history.
- **Done when:** you can answer "who are my best customers?" from the admin.
- **Skills:** `/tdd`, `/teach` for MongoDB aggregation pipelines (`$lookup`, `$group`).

#### Slice 5: Discount codes
- **Backend:** `Discount` model (code, type percent/fixed, value, min order, expiry, usage
  limit, active), validation endpoint, application inside `createOrder` (server-side, never
  trust the client), usage counting.
- **Frontend:** admin discounts CRUD; checkout gets a "discount code" field showing the
  recomputed total.
- **Done when:** a real code changes the order total server-side; expired/overused codes are
  rejected with clear messages.
- **Skills:** `/grill-me` (edge cases galore: stacking? rounding? COD + discount?),
  `/to-tickets`, `/tdd`.

#### Slice 6: Analytics dashboard
- **Backend:** `GET /api/admin/analytics` — revenue by day (last 30), order counts by
  status, top products by quantity, new customers (aggregations; exclude cancelled orders).
- **Frontend:** dashboard home: stat tiles (revenue, orders, customers, avg order value),
  revenue chart, top-products list.
- **Done when:** the admin landing page answers "how is my store doing?" at a glance.
- **Skills:** `/tdd` for the aggregation endpoints, `/to-questionnaire` for metric
  definitions only you can decide (does revenue count unshipped orders?).

---

### Phase 2 — Storefront depth

#### Slice 7: Product variants & image galleries
Shopify's single most-loved catalog feature.
- **Backend:** variants array on Product (name e.g. "Color", options with own price
  delta/stock), order items snapshot the chosen variant; stock logic moves per-variant.
- **Frontend:** variant picker on product page, gallery with thumbnails, cart lines keyed by
  product+variant.
- **Done when:** a t-shirt sells in S/M/L with independent stock.
- **Skills:** `/grill-me` **before building** — variant data-modeling is the riskiest design
  decision in this plan; `/wayfinder` if we decide to remodel stock handling; `/tdd`.

#### Slice 8: Search, filters & recommendations
- **Backend:** price-range + in-stock filters, text index for better search, "related
  products" endpoint (same category, excluding self).
- **Frontend:** filter sidebar (category, price slider, availability), related products on
  the product page, "you may also like" on the cart.
- **Skills:** `/tdd`, `/teach` for MongoDB text indexes vs regex.

#### Slice 9: Reviews & ratings
- **Backend:** `Review` model (user, product, rating 1–5, comment, verified-purchase flag),
  one review per user per product, average rating denormalized onto Product.
- **Frontend:** stars on cards and product page, review list + form (only for purchasers).
- **Skills:** `/tdd`, `/grill-me` on the verified-purchase rule.

#### Slice 10: Store settings & theming (mini theme editor)
Shopify's store-builder concept, scoped sanely.
- **Backend:** singleton `StoreSettings` model: store name, logo URL, accent color, hero
  headline/subtitle/image, announcement bar, footer text.
- **Frontend:** admin Settings form with live preview; storefront reads settings (navbar,
  hero, footer render from them).
- **Done when:** you can rebrand the storefront without touching code.
- **Skills:** `/to-spec`, `/implement`, `/teach` for CSS-variable theming.

---

### Phase 3 — Commerce depth

#### Slice 11: Online payments
- **Backend:** payment-provider abstraction; first provider **SSLCommerz sandbox** (BD
  standard: cards/bKash/Nagad) or Stripe test mode — decide via `/to-questionnaire`.
  Payment intents, success/fail/IPN webhook, `isPaid` driven by verified webhook only.
- **Frontend:** payment method choice at checkout (COD vs online), redirect flow, payment
  status on the order page.
- **Done when:** a sandbox payment marks an order paid via webhook, and tampering with
  amounts client-side is impossible.
- **Skills:** `/grill-me` (security-critical), `/tdd` (webhook verification is a prime test
  target), `/diagnosing-bugs` (webhooks *will* misbehave), `/teach` for payment flows.

#### Slice 12: Shipping options & order timeline
- **Backend:** shipping methods (inside Dhaka / outside, fee, ETA) configured in settings,
  fee added server-side; order status history array with timestamps.
- **Frontend:** shipping choice at checkout; visual order timeline (placed → confirmed →
  shipped → delivered) on the order page.
- **Skills:** `/tdd`, `/implement`.

#### Slice 13: Transactional email
- **Backend:** email service abstraction (Resend/Nodemailer + Ethereal for dev), order
  confirmation + status-change + cancellation emails, sent async so checkout never blocks.
- **Skills:** `/tdd` with a fake mailer, `/teach` for "why queue-like async side effects".

#### Slice 14 (stretch): Multi-currency display, wishlist, inventory low-stock alerts
Pick by appetite when we get here — re-plan with `/wayfinder`.

---

## 4. Sequencing rules

1. **Slices land in order within a phase**; phases can interleave slightly (e.g. Slice 8 can
   precede Slice 7), but Slice 0 blocks everything and Slice 1 blocks all other admin slices.
2. **One slice at a time.** A slice is deployed and demoed before the next spec is written.
3. **Every session starts** by reading this file and `CLAUDE.md`; **every session that ends
   mid-slice ends with `/handoff`.**
4. This file is living: after each slice, mark it ✅ with the date and one line on what
   changed from the plan.

## 5. Immediate next steps

1. Restart Claude Code so the newly installed skills load.
2. Run **`/grill-me`** on this plan — before we write a line of code, your plan gets the
   interrogation. Expect questions like: *why unify admin auth instead of keeping Bearer?
   what does "variant" mean for stock rollback? which metrics define "revenue"?*
3. Then start **Slice 0** with **`/tdd`**.

| Slice | Status |
|-------|--------|
| 0 — Test infrastructure | ⬜ not started |
| 1 — Admin foundation | ⬜ |
| 2 — Product management | ⬜ |
| 3 — Order management | ⬜ |
| 4 — Customers | ⬜ |
| 5 — Discount codes | ⬜ |
| 6 — Analytics dashboard | ⬜ |
| 7 — Variants & galleries | ⬜ |
| 8 — Search & recommendations | ⬜ |
| 9 — Reviews & ratings | ⬜ |
| 10 — Store settings & theming | ⬜ |
| 11 — Online payments | ⬜ |
| 12 — Shipping & timeline | ⬜ |
| 13 — Transactional email | ⬜ |
| 14 — Stretch goals | ⬜ |
