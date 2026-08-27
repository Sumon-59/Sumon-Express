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

## 0. Decision log (grilled 2026-08-26)

The plan was interrogated with `/grill-me`. These decisions are **locked**; changing one
means re-grilling it.

| # | Decision | Outcome |
|---|----------|---------|
| D1 | Working mode | **Revised 2026-08-27 (during Slice 0.5), at Sumon's request:** Claude implements everything; Sumon's role is reading the code and the explanations — no implementation tasks are assigned to him. Claude explains the concepts behind each change. *(Original 2026-08-26: Sumon writes the code; superseded.)* |
| D2 | Dev database | Local dev points at a **separate `sumon_dev` database** on the same Atlas cluster. Only Render uses the production DB. (Slice 0) |
| D3 | Auth architecture | **Canonical JWT pattern for everyone**: access token in memory, axios interceptor auto-refreshes via the httpOnly cookie, single mechanism for shoppers and admin. (Slice 1) Further hardening deferred to Slice 15. |
| D4 | Product images | URL input in Slice 2; **real Cloudinary uploads as dedicated Slice 2b**. |
| D5 | Discount rules | Minimal v1: one code per order, `percent`/`fixed`, min-order, expiry, total usage limit, round **down** to whole taka, order-scoped — with a **forward-compatible schema** (`appliesTo` field from day one). |
| D6 | Revenue definition | Two labeled metrics: **Realized revenue** (delivered/paid) and **Pending value** (pending/processing/shipped). Cancelled counts in neither. |
| D7 | Variants | **One option axis per product** (e.g. Size), each value with its own stock and optional price override. Schema extendable to multi-axis later; multi-axis is out of scope. |
| D8 | Payments | **`PaymentProvider` abstraction; SSLCommerz sandbox is the first implementation.** Stripe test mode only as an optional second provider (stretch). |
| D9 | Git workflow | **Branch per slice** (`slice-0-test-infra`, …). `/code-review` on the branch before merge. Only `fullstack-v2` deploys. Upgrade to GitHub PRs later, together with D10's tracker upgrade, in one "adopt gh tooling" step. |
| D10 | Specs & tickets | **Local files in the repo**: `docs/specs/slice-N.md`, `docs/tickets/`. Migrate to GitHub Issues when the PR workflow is adopted. |
| D11 | Backend language | **Migrate backend to TypeScript as Slice 0.5**, immediately after Slice 0 — the tests from Slice 0 prove the migration broke nothing. |

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

## 2. How we work

### The learning-first contract (D1)

- **Sumon writes the code.** In `/tdd` sessions, Sumon writes both the failing test and the
  implementation; Claude reviews each red-green step and explains, but doesn't type the
  solution.
- Claude may scaffold boilerplate (config files, empty test files, folder moves) **only when
  Sumon approves it explicitly** in the moment.
- Any concept used but not understood → `/teach` it before moving on. If an explanation
  doesn't land → `/wait-what`.

### The slice loop

| Step | What happens | Skill |
|------|--------------|-------|
| 1. Branch | `git checkout -b slice-N-name` (D9) | |
| 2. Spec | Discuss the slice, then turn the conversation into `docs/specs/slice-N.md` (D10) | `/to-spec` |
| 3. Grill | Stress-test the spec before writing code | `/grill-me` |
| 4. Tickets | Break the spec into tracer-bullet tickets in `docs/tickets/` | `/to-tickets` |
| 5. Build | Sumon red-green-refactors each ticket test-first | `/tdd` |
| 6. Review | `/code-review` on the branch; fix findings | `/code-review` |
| 7. Merge & deploy | Merge to `fullstack-v2` → auto-deploys Render + Vercel | |
| 8. Reflect | Review architecture after the slice lands | `/improve-codebase-architecture` |

### Situational skills

| Situation | Skill |
|-----------|-------|
| Something is broken, throwing, failing, or slow | `/diagnosing-bugs` |
| Planning a chunk too big for one session (e.g. a whole phase) | `/wayfinder` |
| Ending a session mid-slice; next session needs context | `/handoff` |
| You want to *understand* a concept we just used | `/teach` |
| A decision needs your input and Claude can't answer it alone | `/to-questionnaire` |
| Claude's last explanation didn't land — demand a re-pitch | `/wait-what` |

> All 12 skills are installed in `~/.claude/skills`. Newly installed ones load when a new
> Claude Code session starts.

**Definition of done for every slice:** tests green (`npm test`), types green
(`npx tsc --noEmit`), build green (`npm run build`), acceptance criteria pass manually,
merged to `fullstack-v2` and deployed, and Sumon can explain how it works.

---

## 3. The slices

### Phase 0 — Foundation

#### Slice 0: Test infrastructure + dev database ⬅ START HERE
Shopify ships nothing untested; neither will we. Everything after this slice is TDD.
- **Dev DB split (D2):** change local `MONGO_URI` to database `sumon_dev`; re-register a
  user and re-seed there. Production data is never touched from this machine again.
- **Backend:** Vitest + Supertest + `mongodb-memory-server` (tests never touch Atlas).
  Refactor `server.js` to export the Express `app` separately from `listen()` so Supertest
  can mount it. First integration tests: auth register/login/me/logout, product listing,
  order lifecycle.
- **Frontend:** Vitest + React Testing Library. First tests: CartContext
  (add/remove/qty/total).
- **Done when:** `npm test` runs green in both apps; the order-lifecycle test would have
  caught the "orders saved with no items" bug we fixed in v2; local dev server writes to
  `sumon_dev` only.
- **Skills:** `/tdd` (this slice *is* the skill's setup step), `/teach` for "how do
  integration tests with an in-memory Mongo work?"

#### Slice 0.5: Backend TypeScript migration (D11)
The backend will never be smaller than now, and the v2 bug class (`items` vs `orderItems`,
`discoutPrice`) is exactly what TS eliminates.
- Convert the ~15 backend files to TypeScript (tsconfig, build script for Render, typed
  Express handlers, typed Mongoose models). Slice 0's tests run unchanged and prove the
  migration broke nothing — which is itself the lesson in why tests come first.
- **Done when:** `npm run build` compiles the backend with zero `any`-escapes in models and
  controllers; all Slice 0 tests still green; Render deploy works with the build step.
- **Skills:** `/tdd` (tests as the safety net), `/teach` for Express + Mongoose typing
  patterns.

---

### Phase 1 — Merchant Admin (Shopify's core)

#### Slice 1: Auth refactor + admin shell (D3)
- **Backend:** single auth mechanism — short-lived access token verified on every protected
  route, refreshed via the httpOnly cookie; role checks from the loaded user. Retire the
  cookie-as-session shortcut and the parallel Bearer path. Promote-to-admin script.
- **Frontend:** access token in memory; axios interceptor auto-refreshes on 401 and retries;
  `/admin` area with sidebar layout (Dashboard, Products, Orders, Customers, Discounts,
  Settings), route guard (admins only), empty pages. **Sumon builds the interceptor in a
  `/tdd` session.**
- **Done when:** an admin can log in and see the shell; a normal user is redirected; a
  15-minute-expired access token refreshes invisibly; logout revokes for real.
- **Skills:** `/to-spec` → `/grill-me` (grill the refresh/retry edge cases) → `/tdd`,
  `/teach` for "why access + refresh tokens".

#### Slice 2: Product management
- **Backend:** enable the commented-out update/delete routes, image **URLs** array (D4),
  validation; tests for create/update/soft-delete/reactivate.
- **Frontend:** product table (search, status filter), create/edit form (name, description,
  price, discount price, stock, category, image URLs), deactivate/activate toggle.
- **Done when:** the whole catalog is runnable from the browser — no more Postman.
- **Skills:** `/to-tickets` (splits naturally: API → table → form), `/tdd`.

#### Slice 2b: Image uploads (D4)
- **Backend:** Cloudinary (free tier) signed uploads; store returned URLs.
- **Frontend:** drag-and-drop upload with previews replacing the URL field.
- **Done when:** a product photo goes from your disk to the storefront without touching a URL.
- **Skills:** `/tdd`, `/teach` for multipart uploads and signed upload flows.

#### Slice 3: Order management
- **Backend:** pagination + status filtering on admin order endpoints; tests for the status
  pipeline rules (no updates after delivered/cancelled, stock restore on cancel).
- **Frontend:** orders table with status pills and filters, order detail drawer (items,
  address, customer), status transition buttons, cancel with confirmation.
- **Done when:** the full pending → processing → shipped → delivered pipeline is drivable
  from the UI, and cancellation restores stock.
- **Skills:** `/tdd` (the pipeline is a textbook state-machine test target), `/teach` for
  "state machines in business logic".

#### Slice 4: Customers
- **Backend:** `GET /api/admin/customers` — users with aggregated order count, total spent
  (lifetime value), last order date (MongoDB aggregation pipeline).
- **Frontend:** customers table, customer detail page with order history.
- **Done when:** "who are my best customers?" is answerable from the admin.
- **Skills:** `/tdd`, `/teach` for aggregation pipelines (`$lookup`, `$group`).

#### Slice 5: Discount codes (D5)
- **Backend:** `Discount` model (code, type `percent`/`fixed`, value, min order, expiry,
  total usage limit, active, `appliesTo: "order"`), validation endpoint, application inside
  `createOrder` (server-side, never trust the client), usage counting, **round down to whole
  taka**. One code per order; no stacking.
- **Frontend:** admin discounts CRUD; checkout gets a "discount code" field showing the
  recomputed total.
- **Done when:** a real code changes the order total server-side; expired/exhausted/below-
  minimum codes are rejected with clear messages. Sumon writes the rules engine test-first.
- **Skills:** `/to-tickets`, `/tdd` (richest pure-logic test matrix in the plan).

#### Slice 6: Analytics dashboard (D6)
- **Backend:** `GET /api/admin/analytics` — **Realized revenue** (delivered/paid) and
  **Pending value** (in-pipeline) by day for the last 30, order counts by status, top
  products by quantity, new customers. Cancelled orders excluded from both metrics.
- **Frontend:** dashboard home: stat tiles (realized revenue, pending value, orders,
  customers, avg order value), revenue chart, top-products list.
- **Done when:** the admin landing page answers "how is my store doing?" at a glance, with
  both metrics clearly labeled.
- **Skills:** `/tdd` for the aggregation endpoints.

---

### Phase 2 — Storefront depth

#### Slice 7: Product variants & image galleries (D7)
- **Backend:** one option axis per product (e.g. `optionName: "Size"`, values each with own
  stock and optional price override); order items snapshot the chosen value; atomic stock
  decrement/rollback targets the variant value. Multi-axis combinations are **out of scope**.
- **Frontend:** variant picker on product page, gallery with thumbnails, cart lines keyed by
  product + variant value.
- **Done when:** a t-shirt sells in S/M/L with independent stock, and cancelling restores
  the right size.
- **Skills:** `/grill-me` on the spec (stock rollback × variants), `/tdd`.

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
- **Backend:** singleton `StoreSettings` model: store name, logo URL, accent color, hero
  headline/subtitle/image, announcement bar, footer text.
- **Frontend:** admin Settings form with live preview; storefront reads settings (navbar,
  hero, footer render from them).
- **Done when:** the storefront can be rebranded without touching code.
- **Skills:** `/to-spec`, `/tdd`, `/teach` for CSS-variable theming.

---

### Phase 3 — Commerce depth

#### Slice 11: Online payments (D8)
- **Backend:** `PaymentProvider` abstraction; **SSLCommerz sandbox** as the first
  implementation (cards/bKash/Nagad in one integration — the realistic BD path to going
  live). Payment initiation, success/fail redirect handling, IPN webhook; `isPaid` driven by
  the **verified webhook only**, never the redirect. Stripe test mode only as an optional
  second provider (stretch).
- **Frontend:** payment method choice at checkout (COD vs online), redirect flow, payment
  status on the order page.
- **Done when:** a sandbox payment marks an order paid via webhook, and tampering with
  amounts client-side is impossible.
- **Skills:** `/grill-me` (security-critical), `/tdd` (webhook verification), 
  `/diagnosing-bugs` (IPN quirks *will* appear), `/teach` for payment flows.

#### Slice 12: Shipping options & order timeline
- **Backend:** shipping methods (inside Dhaka / outside, fee, ETA) configured in settings,
  fee added server-side; order status history array with timestamps.
- **Frontend:** shipping choice at checkout; visual order timeline (placed → confirmed →
  shipped → delivered) on the order page.
- **Skills:** `/tdd`.

#### Slice 13: Transactional email
- **Backend:** email service abstraction (Resend/Nodemailer + Ethereal for dev), order
  confirmation + status-change + cancellation emails, sent async so checkout never blocks.
- **Skills:** `/tdd` with a fake mailer, `/teach` for async side effects.

#### Slice 14: Auth & authorization hardening (from D3's rider)
- Password reset via email token, email verification on signup, Shopify-style **staff roles
  and permissions** (e.g. staff can manage orders but not settings), login notifications,
  session/device list with revocation.
- **Skills:** `/to-spec` → `/grill-me` (threat-model it), `/tdd`, `/teach` for authz models
  (RBAC).

#### Slice 15 (stretch): Multi-currency display, wishlist, low-stock alerts, second payment
provider (Stripe test). Pick by appetite when we get here — re-plan with `/wayfinder`.

---

## 4. Sequencing rules

1. **Slices land in order within a phase**; phases can interleave slightly (e.g. Slice 8 can
   precede Slice 7), but Slice 0 blocks everything, 0.5 blocks Phase 1, and Slice 1 blocks
   all other admin slices.
2. **One slice at a time.** A slice is merged, deployed, and demoed before the next spec is
   written.
3. **Every session starts** by reading this file and `CLAUDE.md`; **every session that ends
   mid-slice ends with `/handoff`.**
4. This file is living: after each slice, mark it ✅ with the date and one line on what
   changed from the plan. Changing a locked decision (section 0) requires re-grilling it.

## 5. Immediate next steps

1. ~~Set up skills~~ ✅ · ~~Explore reference~~ ✅ · ~~Grill the plan~~ ✅ (2026-08-26, 11
   decisions locked)
2. Start **Slice 0**: branch `slice-0-test-infra`, then `/tdd` — the first thing Sumon
   writes is a failing integration test for the order lifecycle.

| Slice | Status |
|-------|--------|
| 0 — Test infrastructure + dev DB | ✅ 2026-08-26 — 25 tests (17 backend, 8 frontend); Sumon wrote the inactive-product test; extra vs plan: idempotent model registration, ESM test files (Vitest 4 requirement) |
| 0.5 — Backend TypeScript migration | ⬜ |
| 1 — Auth refactor + admin shell | ⬜ |
| 2 — Product management | ⬜ |
| 2b — Image uploads | ⬜ |
| 3 — Order management | ⬜ |
| 4 — Customers | ⬜ |
| 5 — Discount codes | ⬜ |
| 6 — Analytics dashboard | ⬜ |
| 7 — Variants & galleries | ⬜ |
| 8 — Search & recommendations | ⬜ |
| 9 — Reviews & ratings | ⬜ |
| 10 — Store settings & theming | ⬜ |
| 11 — Online payments (SSLCommerz) | ⬜ |
| 12 — Shipping & timeline | ⬜ |
| 13 — Transactional email | ⬜ |
| 14 — Auth & authz hardening | ⬜ |
| 15 — Stretch goals | ⬜ |
