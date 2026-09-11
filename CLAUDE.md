# CLAUDE.md — Sumon Express

Full-stack e-commerce app. Two independent apps in one repo, deployed separately:

- `backend/` — Express 5 + Mongoose 9 REST API in **strict TypeScript**, compiled with `tsc` to `dist/` (CommonJS output; production runs `node dist/server.js`). Deployed to **Render** (https://sumon-express-backend.onrender.com) — its build step runs `npm run build` (see `render.yaml`).
- `sumon-express-frontend/` — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + shadcn/ui. Deployed to **Vercel** (https://sumon-express.vercel.app) — the Vercel project's Root Directory setting points at this subdirectory (deliberately no root vercel.json).

Database: MongoDB Atlas — **production uses the `sumon_express` database (Render only); local dev uses `sumon_dev`** on the same cluster (set in `backend/.env`). Tests use an in-memory MongoDB and never touch Atlas.

## Commands

Backend (from `backend/`):
- `npm run dev` — start with tsx watch (port 5000, reads `backend/.env`)
- `npm run build` — compile TypeScript to `dist/` (what Render runs)
- `npm run typecheck` — `tsc --noEmit`, keep it clean
- `npm start` — production start (`node dist/server.js`; requires a build first)
- `npm test` / `npm run test:watch` — Vitest + Supertest integration tests (in-memory MongoDB via `mongodb-memory-server`; see `tests/setup.js`)
- `npm run seed` — seed demo products via tsx (requires at least one registered user; **wipes existing products**)

Frontend (from `sumon-express-frontend/`):
- `npm run dev` — Next dev server on port 3000
- `npm run build` — production build (fails on TS errors — keep it green)
- `npx tsc --noEmit` — quick type check
- `npm test` / `npm run test:watch` — Vitest + React Testing Library (jsdom)

Testing conventions: tests live in `tests/` in each app and assert only through public
seams (the HTTP API via Supertest on the backend; hooks/components on the frontend).
Backend test files stay JavaScript (ESM `import`) on purpose — they are the migration's
impartial safety net; Vitest transpiles them. `backend/app.ts` exports the Express app
(what tests mount); `backend/server.ts` is the runtime entry (dotenv + DB connect +
listen) — keep that split. In `server.ts`, `import "dotenv/config"` must stay the FIRST
import (app.ts reads `CLIENT_URL` at import time).

## Environment variables

Backend `backend/.env` (never commit; on Render set these in the dashboard):
- `PORT`, `NODE_ENV`, `MONGO_URI`
- `JWT_ACCESS_SECRET` — signs 15-min access tokens
- `JWT_REFRESH_SECRET` — signs 7-day refresh tokens
- `CLIENT_URL` — frontend origin, added to the CORS allowlist
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — sign direct
  image uploads (Slice 2b). The secret must never reach the browser, git, or logs; cloud
  name and API key are public by design. Tests use fake values from `tests/setup.js`.

Frontend `sumon-express-frontend/.env.local` (on Vercel set in dashboard):
- `NEXT_PUBLIC_API_BASE_URL` — e.g. `http://localhost:5000/api` locally, `https://sumon-express-backend.onrender.com/api` in prod. This is the **only** API URL var; the shared axios instance lives in `lib/api.ts`.

## Architecture notes

### Auth: one mechanism (canonical JWT, since Slice 1)
- **Access token** — 15-minute JWT signed with `JWT_ACCESS_SECRET`, returned in the login/
  register/refresh JSON body. The frontend keeps it **in memory only** (`lib/api.ts`) and
  sends it as `Authorization: Bearer` on every call. `requireAuth`
  (`middleware/requireAuth.ts`) verifies it on every protected route and attaches the one
  `req.user` shape (`SessionUser`: _id, name, email, role); handlers read it via the
  `sessionUser(req)` accessor. Admin routes chain `requireAdmin` (403 for non-admins).
- **Refresh token** — 7-day JWT with a unique `jti`, stored in the httpOnly cookie `jwt`
  AND on the user record. `GET /api/auth/refresh` (cookie-authed) rotates it and mints a
  new access token; reusing a rotated-away cookie fails. Logout clears the cookie and the
  stored token, so no new access tokens can be minted; outstanding access tokens die
  within 15 minutes (no denylist — accepted).
- **Frontend engine** (`lib/api.ts`): request interceptor attaches the Bearer header; the
  response interceptor does single-flight refresh on 401 and retries once. Only a
  definitive 401/403 from refresh logs the user out — transient errors (5xx, network,
  Render cold start) fail the one request without ending the session.
- All token verification goes through `verifyToken` in `utils/token.ts` — don't hand-roll
  `jwt.verify` at call sites.
- Promote an admin: `npm run promote -- <email>` (backend; acts on the `.env` database).

### CORS
Allowlist in `app.ts` (`allowedOrigins`) + `credentials: true`. When the frontend gets a new domain (e.g. a Vercel preview URL), it must be added there or via `CLIENT_URL`.

### Orders
- Order items are stored under `items` in `Order.model.ts` (embedded snapshot: product ref, name, price, quantity). The admin and user controllers both read `order.items`.
- `createOrder` computes `totalPrice` server-side from DB prices (`discountPrice ?? price`) — never trust client totals.
- Stock is decremented with a guarded atomic `findOneAndUpdate` (`stock: { $gte: qty }`, `$inc`) with manual rollback of prior decrements on failure; cancel restores stock the same way. There are no multi-document transactions.
- Cancellation allowed for status `pending`/`processing` only.
- **Status pipeline is a state machine (since Slice 3)**: forward-only along
  `pending → processing → shipped → delivered` (skips allowed), terminal states
  immutable, and the status route refuses `cancelled`/`pending` as targets —
  cancellation's only door is the cancel endpoint, the one code path that restores
  stock. Delivered sets `isPaid`/`paidAt`. Every rule is a 400 naming it, each with a
  test in the pipeline test file.
- **Admin listing**: `GET /api/admin/orders` answers `{orders, total, page, pages}`
  (`status` filter — closed set, invalid values 400 — plus `page`/`limit`), newest
  first, customer populated, items snapshot embedded (the UI drawer needs no second
  request). The frontend actions component mirrors the machine: legal moves only.

### Customers (since Slice 4)
- **The census is one aggregation pipeline** in `adminCustomer.controller.ts`: role-user
  `$match` → `$lookup` of that user's orders with an inner `$match` excluding
  `cancelled` (one rule feeding all three columns) → `$addFields` collapsing the join to
  `orderCount` (`$size`), `totalSpent` (`$sum`), `lastOrderAt` (`$max`; null = never
  ordered) → whitelisting `$project` (password/refreshToken can never leak). Sort, skip,
  and limit run inside the pipeline. No `$unwind` — that's the multiply-count trap.
- `GET /api/admin/customers` (`sort` = `spent` default | `newest` — closed set, 400
  otherwise; `page`/`limit`) answers `{customers, total, page, pages}`. Admins are
  excluded. `GET /api/admin/customers/:id` = identity + the same numbers (400 malformed
  id, 404 unknown/admin). A customer's order history is the orders listing with its
  `user` filter — there is deliberately no separate history endpoint.
- **Pagination lives in `utils/pagination.ts`** (`parsePagination` clamps page ≥ 1,
  1 ≤ limit ≤ 100; `pageMeta` builds the wrapper) — all three admin listings use it; new
  listings must too. Frontend mirror: `PageMeta` in `types/api.ts`, `formatDate` in
  `lib/format.ts`.
- Deep link: `/admin/orders?user=<id>&open=<orderId>` filters the Orders page to one
  customer and opens the drawer on that order (used by customer detail rows).

### Discount codes (since Slice 5)
- **`resolveDiscount` in `utils/discountRules.ts` is THE rules choke point** — preview
  and order creation both call it, nowhere else. One named 400 per refusal: unknown /
  inactive / expired / below-minimum (names the minimum) / usage-limit. Amount always
  **floors to whole taka** (percent AND the fixed-cap path); fixed values must be whole
  taka at creation. Codes stored uppercase + unique; lookup uppercases input.
- **Usage is claimed, never counted**: `claimDiscountUsage` is a guarded atomic
  findOneAndUpdate (re-checks isActive, expiry, and limit inside the update — one
  winner per last slot, the stock pattern). Order creation order: rules → stock
  decrement → usage claim → create; every later failure rolls back every earlier side
  effect (`releaseDiscountUsage` + stock restore). Orders store a
  `{code, type, value, amount}` **snapshot** — receipts never re-read the Discount.
- `POST /api/discounts/preview` (requireAuth) recomputes the subtotal via
  `utils/orderItems.ts` `buildOrderItems` — the ONE cart→subtotal computation shared
  with createOrder — and consumes nothing. Admin CRUD under `/api/admin/discounts`
  (list/get/create/update; **no hard delete** — deactivate via update); validation
  choke point `validateDiscountData` mirrors the product one. Mongo E11000 maps to 400
  in the error middleware.
- Frontend: `components/checkout/DiscountField.tsx` displays only server-computed
  numbers; the code rides the order payload as `discountCode`. Snapshot lines render
  in the shopper history and admin drawer.

### Analytics (since Slice 6)
- `GET /api/admin/analytics` answers the whole dashboard in one response: all-time
  tiles (realized = delivered; pending value = pending/processing/shipped; floored
  AOV over non-cancelled orders), per-status counts (cancelled visible as churn but
  feeding no metric), a continuous 30-day UTC daily series (bucketed by creation
  date, current status decides the line, zeros for silent days), top 5 products by
  quantity from the item snapshots, 30-day signups. Parallel aggregations; the
  status grouping feeds tiles AND breakdown.
- Frontend chart (RevenueChart): stacked bars, validated 2-hue palette
  (#ea580c/#2563eb — run the dataviz validator before changing), pending hatched so
  the split survives CVD/print, one axis, ORDER_STATUS_ORDER is the canonical
  status list for every surface.

### Product management (since Slice 2)
- **Soft delete is the only delete.** `DELETE /api/products/:id` sets `isActive: false`;
  nothing is ever removed (order snapshots depend on it). Reactivate via
  `PUT /api/products/:id` with `isActive: true`.
- **`validateProductData` in `product.controller.ts` is THE validation choke point** for
  create and update — price ≥ 0, stock a non-negative integer, discount strictly below
  the *effective* price (partial updates validate against existing values), name/
  description non-empty, category a valid ObjectId. Violations answer 400 naming the
  field. Add new product rules there, nowhere else.
- **Admin catalog endpoints**: `GET /api/admin/products` (all statuses; `q`, `status`
  active|inactive|all, `page`/`limit`) and `GET /api/admin/products/:id` (returns
  inactive products — the public detail 404s them by design; the edit page needs this).

### Reviews & ratings (since Slice 9)
- Eligibility = a DELIVERED order containing the product (pipeline/cancelled don't
  count); named 403 otherwise. One review per user per product — the compound unique
  index IS the rule (E11000→400 covers races). Owner-only edit/delete.
- `ratingAvg`/`ratingCount` on Product are RECOMPUTED from the Review collection on
  every review write, never incremented (store what you claim — usedCount; recompute
  what you derive — ratings, the census). Corruption self-heals on the next write.
- Endpoints: `GET/POST /api/products/:id/reviews` (list public with name-only
  populate — never email; create auth+eligible), `GET …/reviews/eligibility` (auth →
  {canReview, alreadyReviewed}), `PUT/DELETE /api/reviews/:id` (owner). Frontend:
  `Stars`/`StarRow` (icons + numeric text, hidden at zero), `ProductReviews`
  (load-more accumulation, eligibility-driven form).

### Auth hardening & RBAC (since Slice 14)
- **Password reset**: `POST /api/auth/forgot-password` answers the SAME 200
  either way (no enumeration; a timing residual is accepted and rate-capped).
  Only the token's SHA-256 is stored (`resetTokenHash`/`resetTokenExpires`,
  both select:false); the raw token exists in the email alone. 1h expiry,
  single-use (cleared on success), lookup by hashed filter (no string
  compare). `POST /api/auth/reset-password`: one named 400 for
  invalid-and-expired alike; success revokes the refresh token (every
  session dies) and emails a changed notice.
- **`PUT /api/auth/password`** proves currentPassword, applies THE shared
  policy (`validatePassword` in utils/password.ts, min 8 — register/reset/
  change all use it), revokes other sessions, and re-issues a fresh pair to
  the caller. Login sends a fire-and-forget notification email.
  forgot/reset/change each have their OWN 10-per-15-min rate bucket
  (rateLimit.middleware) — never share buckets across credential routes.
- **RBAC**: `requireRole(...roles)` generalizes `requireAdmin`
  (= requireRole("admin"), same export). The permission map lives in
  admin.routes.ts: staff touch ORDERS ONLY; everything else (incl. product/
  category writes outside that file) stays admin-only — the matrix test
  pins all of it. Role writes: `PUT /api/admin/customers/:id/role`, closed
  set user|staff (no admin-minting over HTTP, no self-demotion; admin
  promotion stays `npm run promote`). Demotion is instant — requireAuth
  reloads the role from the DB per request. The census AND analytics count
  staff as customers (they shop too).
- Production console-mailer REDACTS bodies (reset links must never reach
  platform logs). Frontend: /forgot-password, /reset-password (token
  scrubbed from history), /account; admin nav mirrors the permission map
  for staff.

### Transactional email (since Slice 13)
- **The mailer boundary** (`src/mail/`): shared shapes in `types.ts`;
  `getMailer()` selects test → FAKE (in-memory `outbox` + `failNext()` dial,
  `resetMailFake()` in beforeEach), `RESEND_API_KEY` → Resend (plain fetch,
  no SDK, 10s timeout, `MAIL_FROM` default), else → console mailer (logs
  every mail; unconfigured environments stay functional, never silently
  broken).
- **Fire-and-forget is the contract, enforced in ONE place**: `dispatch` in
  `orderEmails.ts` is throw-proof AND rejection-proof — mail is never
  awaited by a handler, and a mail failure can never fail or delay a
  request (pinned by the failNext test). The buyer-address lookup is an
  inline DB read (that's not mail).
- Emails are built synchronously from the ORDER SNAPSHOT only (items,
  shipping, discount, total — never re-reading Product/Settings). Triggers:
  order confirmation, each status change (delivered mentions collection),
  both cancel doors (say who cancelled). Deliberately NO payment-received
  email on IPN success (owned in the spec's Out of Scope).
- `GET /api/admin/mail-status` answers `{mailer, from}` — the deploy-probe
  seam: proves which mailer the runtime selected without leaking any
  credential. Optional: a free Resend API key in Render flips it from
  "console" to "resend".

### Shipping & order timeline (since Slice 12)
- **`shippingMethods` live on the StoreSettings singleton** (defaults: Inside
  Dhaka ৳60 / Outside ৳120) — full-array replace through
  `validateSettingsData`: 1–5 methods, slug keys (`[a-z0-9-]`, stored
  lowercase), whole-taka integer fees, capped label/eta, named 400s.
- **Orders require a known `shippingMethod` key** (named 400 pre-side-effect,
  input normalized like stored keys) and carry a `shipping`
  `{key,label,fee,eta}` SNAPSHOT — fee edits never re-price the past.
  `totalPrice = (subtotal − discount) + fee`; discounts stay GOODS-only
  (resolveDiscount sees the subtotal, never the fee). Payments are
  fee-transparent (they trust totalPrice).
- **`history: [{status, at}]` is written ONLY through `recordStatus`**
  (`utils/orderStatus.ts`) — creation seeds pending through it, the status
  route and both cancel doors append through it; illegal moves append
  nothing; history is append-only and caps at ~5 entries. Legacy orders
  (no shipping/history) stay readable; the frontend `OrderTimeline` falls
  back to createdAt + current status.
- Tests: `helpers.ensureShipping()` plants a FREE "standard" method
  ($setOnInsert) and `placeOrder` sends it by default, keeping pre-slice
  total assertions honest; nonzero-fee behavior is pinned in
  `shipping.test.js`. Frontend `SettingsProvider` merges responses over
  `DEFAULT_SETTINGS` (deploy-window skew must not break checkout).

### Online payments (since Slice 11)
- **The trust boundary**: the PROVIDER (`src/payments/`) answers "what does
  the gateway say happened"; the CONTROLLER (`payment.controller.ts`) judges
  "does that match MY order". The IPN body is UNTRUSTED (anyone can POST a
  webhook) — only the server-to-server validator answer counts, and paid
  requires ALL of: verified, status VALID/VALIDATED, **validator tran_id ===
  the order's stored attempt** (the cross-transaction-replay check — never
  remove it), amount === totalPrice exactly.
- **`isPaid` has exactly two writers**: the admin delivered rule (ANY
  method — delivery implies collection, the deliberate cash-on-handover
  fallback) and the verified IPN. Redirect endpoints are 303 UX that write
  NOTHING. Paid/failed transitions are GUARDED atomic findOneAndUpdates
  (isPaid false + live tranId + not cancelled — the stock/discount
  doctrine); duplicate IPNs are idempotent; a re-init mints a fresh tranId
  and only the latest is honored (`payment.tranId` unique+sparse index).
- New orders accept only `cod`/`online` (named 400; legacy instrument enum
  values stay readable on old docs). SSLCommerz sandbox needs
  `SSLCOMMERZ_STORE_ID`/`SSLCOMMERZ_STORE_PASSWD` (+`SSLCOMMERZ_SANDBOX`
  default true); without them init answers a named 503. Outbound gateway
  fetches carry 10s timeouts. Tests drive the FAKE provider
  (`payments/fake.ts` — its documented body-field dials include
  `fake_validator_tran_id` for replay tests); never point tests at the
  real gateway.
- Frontend: checkout radio (cod default), online = order → `/payments/init`
  → `window.location.assign(redirectUrl)`; cart clears at order creation
  (Pay Now on /orders recovers an abandoned gateway visit); one
  `paymentBadge` rule (Paid / Awaiting payment / Payment failed — text,
  never color alone); `?paid=` return notice is honest about webhook
  timing.

### Store settings & theming (since Slice 10)
- **`StoreSettings` is a SINGLETON at a fixed `_id`** (`SETTINGS_ID` in
  `settings.controller.ts`). An upsert is race-safe ONLY on a uniquely-indexed
  filter — never upsert on `{}` (two concurrent first-touches can each insert).
  Writes go through the `theSettings` helper; the public read is `findById`
  first, upsert only as the not-yet-created fallback — **a read must be a
  read** (no DB write per storefront visit, no `updatedAt` churn).
- `GET /api/settings` is public (the brand renders for anonymous shoppers);
  `PUT /api/admin/settings` is a partial merge through the
  **`validateSettingsData` choke point**: hex accent (stored lowercase), trims
  + caps, http(s)-only URL fields (empty string clears), named 400s. Defaults
  reproduce the pre-slice hardcoded brand, so a fresh DB renders unchanged.
- **Theming = one CSS variable**: `SettingsProvider` writes `accentColor` into
  the document-root `--primary` — the token every shadcn `bg-primary`/
  `text-primary` utility resolves to — so one write recolors the site. Guard
  what reaches the DOM with `isHexColor` (`types/settings.ts`, the shared
  rule). Frontend `DEFAULT_SETTINGS` mirrors the schema defaults and renders
  while loading/on fetch failure — the storefront never blanks. Announcement
  bar renders only when non-empty. Brand images ride the Slice 2b upload
  helper (`uploadImage`).

### Search & discovery (since Slice 8)
- Public listing: `q` runs the **text index** first (name weight 10, description 3,
  relevance-ranked unless an explicit sort) and falls back to an ESCAPED name regex
  when the index matches nothing (partials). Never interpolate raw user input into
  `$regex` — use `escapeRegex` in `utils/regex.ts`.
- **One definition of price**: filters (`minPrice`/`maxPrice`, inclusive, named 400s,
  Infinity rejected) AND `price_asc`/`price_desc` sorts both use the effective price
  (`discountPrice ?? price`) via the shared listing aggregation. `inStock=true` rides
  the variant stock sum. Aggregation gotcha: `aggregate()` does not auto-cast
  ObjectId strings — cast category ids explicitly.
- `GET /api/products/:id/related`: ≤4 same-category active siblings, self excluded,
  empty for uncategorized, 404 unknown/inactive. Frontend `RelatedProducts` strip
  renders nothing when empty (product page + cart).

### Product variants (since Slice 7)
- One optional option axis per product: `optionName` + `variants: [{name, stock,
  price?}]` (multi-axis is out of scope, D7). Plain products are untouched. Top-level
  `stock` on a variant product is the SUM of value stocks — the axis rules live inside
  `validateProductData` (still THE one choke point; client stock is ignored on variant
  products), and order-time math maintains the sum with one atomic dual-`$inc`
  (value + sum, same document, `$elemMatch` guard).
- **The stock engine is `claimItemStock`/`restoreItemStock`/`restoreOrderStock` in
  `utils/orderItems.ts`** — order creation and BOTH cancel paths use it; never
  hand-roll stock math elsewhere. Restore falls back to the top-level counter when the
  snapshotted value no longer exists — a documented FAMILY (value renamed away; plain
  order cancelled after the product gained an axis): aggregate stock is always
  preserved, per-value accuracy is the cost of re-shaping with open orders.
- Order lines: identity is product+variant (`variant` in the payload, required iff the
  axis exists, named 400s otherwise); snapshots carry `variantName`; unit price is
  `variant.price ?? discountPrice ?? price`. Frontend mirrors: cart `sameLine`/
  `lineKey` in CartContext, `lineLabel` in lib/format, picker + gallery on the product
  page, axis editor in ProductForm (full-axis replace; null/null removes the axis).

### Image uploads (since Slice 2b)
- **Signed direct upload**: the browser asks `POST /api/admin/uploads/signature`
  (requireAuth + requireAdmin) for `{cloudName, apiKey, timestamp, folder, signature}`,
  then sends the file bytes straight to Cloudinary — they never touch our backend. The
  signature is SHA-1 over `folder=…&timestamp=…` + secret (Cloudinary's scheme), computed
  with Node's built-in crypto in `upload.controller.ts` — no Cloudinary SDK.
- Uploads land in the Cloudinary folder `sumon-express/products` (server-chosen and
  signed — the browser can't redirect them). The returned `secure_url` goes into the
  product's existing `images: string[]`; nothing downstream knows or cares whether a URL
  was uploaded or pasted.
- Frontend helper `lib/uploads.ts`: pre-flight checks (image/*, ≤ 5 MB) before any bytes
  move; the Cloudinary POST uses **plain axios, never the `api` instance** — our Bearer
  header and cookies must not leak to a third party (same rule as the refresh call).
  Cloudinary errors arrive as `{error:{message}}` and are unwrapped for display.
- Removing an image row never deletes the Cloudinary asset (orphans accepted, free tier).
- The signature test recomputes the SHA-1 independently and asserts byte equality —
  change the folder, params, or hash and it goes red by design.

### Product pricing field
The field is `discountPrice`. (It was historically misspelled `discoutPrice` across backend + frontend; that's fixed — don't reintroduce the typo, and note old DB documents may still carry the misspelled field.)

### Frontend state
- `context/AuthContext.tsx` — backend is source of truth; every login/register is followed by `GET /auth/me`. `login`/`register` take a single object arg and return `Promise<void>`; errors are thrown (catch in the page).
- `context/CartContext.tsx` — cart lives in `localStorage` (`cart_items_v1`), never on the server. Checkout posts `{ items: [{product, quantity}], shippingAddress }`.
- Route guards are client-side `useEffect` redirects on `/checkout` and `/orders` (no Next middleware).

## Gotchas
- Express 5: async errors still go through `utils/asyncHandler.js` → `middleware/error.middleware.js`. Throw `Error` with `err.statusCode` set; don't call `res` after `next(err)`.
- Never `throw` inside a `jwt.verify` callback — use the synchronous `jwt.verify` return + try/catch (async callback throws become unhandled rejections).
- Render free tier sleeps; first request after idle takes ~30–60s. `/healthz` exists for uptime pings.
- `backend/.env` holds real Atlas credentials — it is gitignored via the root `.gitignore`; keep it that way.
- The seed script (`src/seed/products.seed.ts`) deletes ALL products before inserting, and points at whatever `MONGO_URI` is in `.env` — check before running against prod.
