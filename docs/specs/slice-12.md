# Slice 12 — Shipping options & order timeline

Status: ready-for-agent
Branch: `slice-12-shipping`
Seam decision (full-autonomy contract): backend HTTP seam for shipping math,
snapshots, and the history invariants; frontend extends the checkout payload
test (method + fee ride the order); the timeline itself is rendering —
browser-checked.

## Problem Statement

Delivery is free and instant in our fiction: no shipping fee, no ETA, and the
only trace of an order's journey is its current status — a shopper can see
"shipped" but not when it was confirmed or how long each step took. The store
owner eats delivery costs, and "where is my order?" has a one-word answer.

## Solution

Shipping methods (e.g. Inside Dhaka / Outside Dhaka — fee and ETA each) are
**configured in StoreSettings** (the Slice 10 singleton — one more brand
decision the owner edits, no code). Checkout picks one; the server prices it
(fee added server-side to the total — client numbers stay untrusted) and
**snapshots** the chosen method onto the order (the receipts doctrine: orders
never re-read settings). Every status transition now appends to a **history
array with timestamps**, and the order page renders it as a visual timeline
(placed → processing → shipped → delivered, cancellation as a terminal mark).

## User Stories

1. As a shopper, I want to choose a shipping option at checkout and see its fee and ETA before paying, so that the total holds no surprises.
2. As the store owner, I want to configure shipping labels, fees, and ETAs from the admin Settings page, so that pricing changes need no developer.
3. As a shopper, I want my order's total to include exactly the fee that was advertised at checkout — even if the owner changes fees later (snapshot).
4. As a shopper, I want a visual timeline showing when each step of my order happened, so that "where is my order?" answers itself.
5. As the store owner, I want tampered or unknown shipping choices refused server-side, so that nobody ships free by editing the request.
6. As a developer, I want the fee math and the history invariants pinned through the HTTP API, so that neither can silently regress.

## Implementation Decisions

- **Shipping lives in settings**: `StoreSettings` gains `shippingMethods:
  [{key, label, fee, eta}]` — key a slug (unique within the array), label
  human text, fee a non-negative WHOLE-taka integer (the Slice 5 money rule),
  eta free text ("1-2 days"). Defaults: Inside Dhaka ৳60 "1-2 days" /
  Outside Dhaka ৳120 "3-5 days". Validation folds into
  **`validateSettingsData`** (THE settings choke point): 1–5 methods,
  full-array replace on PUT (the variants-axis convention), named 400s
  (empty label, negative/fractional fee, duplicate keys, empty/oversized
  array). Public `GET /api/settings` already serves them to checkout free.
- **Order creation**: the payload gains required `shippingMethod: <key>`
  (named 400 when missing or unknown — the closed-set convention). The
  server resolves the method from settings AT order time, snapshots
  `shipping: {key, label, fee, eta}` onto the order, and computes
  `totalPrice = (subtotal − discountAmount) + fee`. Discounts keep applying
  to GOODS only: `resolveDiscount(subtotal)` is unchanged — minimums and
  caps never see the fee (a fixed discount can zero the goods, never the
  shipping). Legacy orders without `shipping` stay readable; every payment
  path (Slice 11) is fee-transparent because it already trusts only
  `totalPrice`.
- **Status history**: Order gains `history: [{status, at}]`. Creation seeds
  `[{status: "pending", at: now}]`; every legal transition APPENDS — one
  tiny helper `recordStatus(order, status)` (in the order-status util
  space) is the only way status is written, used by the admin status
  route and BOTH cancel paths, so history can never diverge from status.
  History is append-only; nothing ever rewrites it (delivered's
  isPaid/paidAt stays separate — payment is not a pipeline step).
- **Frontend**: checkout gains a shipping radio rendered from
  `useSettings().settings.shippingMethods` (fee + ETA on each option, first
  method preselected), a Delivery line replacing the hardcoded "Free", and
  the client-side displayed total = subtotal − discount + fee (display
  only; the server recomputes, as everywhere). Orders page: an
  `OrderTimeline` component — dots and a connecting line for
  placed → processing → shipped → delivered with timestamps from history
  (a step not yet reached renders muted; cancelled renders a red terminal
  mark after its last real step). Legacy orders without history fall back
  to createdAt + current status. The shipping line (label + fee + eta)
  shows in the order card and the admin drawer inherits it from the
  snapshot automatically wherever totals are shown.
- **Settings admin page**: a Shipping methods editor — rows of
  label/fee/eta (key derived from the label, slugified, stable while
  editing), add/remove within 1–5 (the ProductForm axis-editor pattern).

## Testing Decisions

- **Backend (Supertest):**
  - settings: defaults carry both methods on first GET; PUT replaces the
    array; validation matrix — empty label, negative fee, fractional fee,
    duplicate keys, empty array, six methods → named 400s;
  - order pricing: order with a method → `totalPrice = subtotal + fee` and
    the full snapshot (key/label/fee/eta) on the order; with a discount →
    `subtotal − amount + fee`; **fee changes later, snapshot holds** (edit
    settings after ordering; the order's shipping and total are unchanged);
  - refusals: missing shippingMethod → named 400; unknown key → named 400
    (and no stock moved — the refusal is pre-side-effects);
  - history: a fresh order's history is exactly `[pending]`; walking
    pending → processing → shipped → delivered appends in order with
    non-decreasing timestamps; user cancel and admin cancel each end
    history with `cancelled`; illegal moves append nothing;
  - payments regression: an online order's init/IPN flow prices the
    fee-inclusive total (the amount check keeps using totalPrice).
- **Frontend**: extend the checkout test — the shipping radio renders from
  (faked) settings, the payload carries the chosen `shippingMethod`, and
  the displayed total includes the fee. Timeline rendering browser-checked.
- **Deploy probe**: production settings answer `shippingMethods` (absent in
  old payload = version-distinguishing); an authenticated order priced with
  fee in production would consume stock — instead probe the REFUSAL seam:
  an order with an unknown shipping key answers the named 400 (proves the
  new pricing path runs) — plus the settings write round-trip for a fee
  edit, restored after. (Render deploy stall from Slice 11 may gate this —
  the probe doubles as the resumed-deploys signal.)

## Out of Scope

- Weight/price-based rate tables, per-product shipping, free-shipping
  thresholds, carrier APIs / tracking numbers.
- Estimated-date arithmetic (ETA stays honest free text).
- Notifying shoppers of transitions (Slice 13, email).
- Backfilling history for pre-slice orders (fallback rendering instead).
- Admin editing of an order's shipping after placement.

## Further Notes

- Snapshot vs live is the slice's teaching moment, third time round:
  discounts (Slice 5) and order items (Slice 0) snapshot for the same
  reason — a receipt is a statement about the PAST; settings are a
  statement about NOW.
- `recordStatus` is deliberately the only status writer — the same
  "one door" shape as the cancel/stock rule from Slice 3: invariants live
  in doors, not in callers' discipline.
