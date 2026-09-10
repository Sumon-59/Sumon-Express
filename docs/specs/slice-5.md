# Slice 5 — Discount Codes (the rules engine)

Status: ready-for-agent
Branch: `slice-5-discount-codes`
Seam decision (made under the 2026-09-10 full-autonomy contract): backend HTTP seam
carries the entire rules matrix; one frontend component test covers the checkout
discount field (the only logic-bearing UI piece); the rest of the UI is browser-checked.

## Problem Statement

As the store owner, I have no way to run a promotion. I can't offer "10% off for Eid",
"৳500 off orders over ৳3,000", or a launch code limited to the first 100 uses. Every
competitor's checkout has a discount-code field; mine doesn't, and there is no admin
surface to create or manage codes even if it did.

## Solution

The admin gets a Discounts section: create codes (percent or fixed amount) with optional
minimum order, expiry date, and total usage limit; deactivate them anytime; watch usage
counts climb. The shopper gets a code field at checkout: typing a valid code shows the
discount and the new total before ordering; the server recomputes and enforces
everything at order time, so an invalid, expired, exhausted, or below-minimum code is
rejected with a message naming exactly why. Discount money always rounds down to whole
taka, in the shopper's favor.

## User Stories

1. As an admin, I want to create a percent code (e.g. EID10 = 10% off), so that I can run a storewide promotion.
2. As an admin, I want to create a fixed-amount code (e.g. FLAT500 = ৳500 off), so that I can offer flat savings.
3. As an admin, I want to set a minimum order amount on a code, so that FLAT500 can't be used on a ৳600 order.
4. As an admin, I want to set an expiry date, so that a campaign ends itself.
5. As an admin, I want to set a total usage limit, so that "first 100 customers" is enforceable.
6. As an admin, I want to see all my codes in a table with status and usage counts, so that I can watch a campaign run.
7. As an admin, I want to edit a code's terms and deactivate it instantly, so that a mispriced code can be stopped.
8. As an admin, I want codes stored uppercase and unique, so that eid10 and EID10 are the same code and duplicates are impossible.
9. As a shopper, I want to type a code at checkout and see the discount and new total before placing the order, so that I know what I'll pay.
10. As a shopper, I want a clear message when my code is rejected — unknown, inactive, expired, exhausted, or below the minimum — so that I know whether to fix my cart or drop the code.
11. As a shopper, I want to remove an applied code, so that a change of mind is one click.
12. As a shopper, I want my order and its history to show the code and amount saved, so that the receipt matches what I saw.
13. As a shopper, I must NOT be able to stack codes, so that one order carries at most one code.
14. As an admin, I want the admin order drawer to show the discount a customer used, so that support questions about totals are answerable.
15. As an attacker, I must NOT be able to get a discount by sending a forged total or amount — the server recomputes everything from DB prices and its own rules.
16. As two simultaneous shoppers, we must NOT both consume the last use of a limited code — usage is claimed atomically, like stock.
17. As a developer, I want every rule as one small HTTP test with fixture-controlled dates, so that the matrix is executable and the suite never sleeps or flakes.

## Implementation Decisions

- **New model: Discount** — `code` (unique, stored uppercase, trimmed), `type`
  (`percent` | `fixed`), `value` (percent 1–100; fixed > 0), `minOrder` (≥ 0, default
  0), `expiresAt` (optional date; absent = never expires), `usageLimit` (optional
  positive integer; absent = unlimited), `usedCount` (default 0), `isActive` (default
  true). `appliesTo` is deliberately omitted from the schema — YAGNI; order-level is the
  only behavior, and a field with one legal value is speculative generality (recorded
  deviation from the plan line).
- **One shared rules function** is the single validation choke point (the discount
  sibling of `validateProductData`): given a code string and a server-computed subtotal,
  it answers the discount document + the rounded-down amount, or throws a 400 naming
  exactly one reason — unknown code, inactive, expired, below minimum (naming the
  minimum), exhausted. Lookup is by uppercased input. Both the preview endpoint and
  order creation call it; the rules exist nowhere else.
- **Amount math:** percent → `floor(subtotal × value / 100)`; fixed → `min(value,
  subtotal)` (a code can never push a total below zero). Total = subtotal − amount.
  Whole-taka floor, always in the shopper's favor.
- **Preview endpoint** (authenticated, not admin): takes the cart's items (product id +
  quantity) plus the code, recomputes the subtotal from DB prices exactly as order
  creation does, runs the rules, answers `{code, subtotal, discountAmount, total}` —
  or the named 400. The client's own subtotal is never accepted. Preview does NOT
  consume usage.
- **Order creation** accepts an optional `discountCode`. After computing the subtotal
  and before creating the order it runs the same rules, then **claims usage
  atomically**: one guarded `findOneAndUpdate` (`isActive`, not-expired, and
  `usedCount < usageLimit` when limited) increments `usedCount` — the same
  claim-don't-count pattern as stock. If the claim loses a race, the order fails with
  the exhausted message and prior stock decrements roll back; if order creation fails
  after a successful claim, the claim rolls back. The order stores a **discount
  snapshot** — `{code, type, value, amount}` — alongside the discounted `totalPrice`,
  so history renders without a Discount lookup (the same snapshot philosophy as order
  items).
- **Admin CRUD**: listing (paginated via the shared helper, newest first, no filters
  yet), create, update (partial, validated against effective values like the product
  choke point), and deactivate/reactivate via update — **no hard delete** (order
  snapshots and campaign history outlive campaigns; consistent with soft-delete-only).
  All behind requireAuth + requireAdmin. Validation mirrors `validateProductData`
  style: 400 naming the field.
- **Frontend**: an admin Discounts table + create/edit form pages (the products-section
  pattern); the checkout page gains a code field with Apply/Remove calling the preview
  endpoint, a discount line + recomputed total, and server messages shown verbatim;
  `discountCode` rides the existing create-order payload; the shopper's order history
  and the admin order drawer render the snapshot line ("EID10 −৳120") when present.
- Expiry compares against the current time at request time; no scheduler deactivates
  codes — an expired code is simply refused (state you don't have to maintain can't
  drift).

## Testing Decisions

- Good tests assert **behavior through the HTTP seam with fixture-controlled time** —
  a code that expired yesterday, one expiring tomorrow — never `sleep`, never mocking
  Date globally (dates live in the fixtures).
- **Backend (Supertest + in-memory Mongo; prior art: pipeline + census tests,
  `plantProduct`/`placeOrder`/`registerAdmin` helpers; a `plantDiscount` fixture
  helper joins them):**
  - the matrix, one test per cell: valid percent (with floor rounding proven by an odd
    subtotal), valid fixed, fixed capped at subtotal, unknown code, inactive, expired
    yesterday, valid-until-tomorrow passes, below minimum (message names the minimum),
    exhausted (usedCount = usageLimit), case-insensitive lookup (eid10 = EID10);
  - preview: correct numbers, does not consume usage, requires auth;
  - order creation: applies the code (totalPrice discounted, snapshot stored, usedCount
    incremented — usage asserted by exhausting a limit-1 code with a second order, not
    by reading the database); a rejected code fails the order AND leaves stock
    untouched (the rollback path); order without a code is unchanged (regression);
  - admin CRUD: create validates (bad type, percent out of range, negative value/
    minOrder, duplicate code 400 naming the field), update validates against effective
    values, deactivate-is-update works, listing paginates, 401/403 everywhere;
  - the uniqueness rule survives casing (creating "eid10" after "EID10" is a 400).
- **Frontend (Vitest + RTL, mocked adapters; prior art: upload tests):** one file for
  the checkout discount field — apply success shows amount + new total, server
  rejection shows the server's message, remove resets to the undiscounted total, the
  applied code rides the order payload.
- Deploy probes: the preview endpoint 404 → 401 in production, plus one real code
  created and previewed against production via authenticated API calls.

## Out of Scope

- Per-customer usage limits ("once per account"), first-order-only codes.
- Product- or category-scoped discounts (`appliesTo` variants), free shipping codes.
- Stacking multiple codes; automatic (no-code) promotions.
- Scheduled activation (start dates) — only expiry ends a campaign.
- Admin analytics beyond the usage count (revenue impact arrives with Slice 6).
- Migrating or honoring any legacy discount fields.

## Further Notes

- The plan line "Sumon writes the rules engine test-first" predates the revised D1 and
  the 2026-09-10 full-autonomy contract — Claude writes it; the matrix tests are the
  reading material.
- `usedCount` is data, not truth-by-recount: it's incremented atomically at claim time
  and decremented on rollback, never recomputed from orders. The census (Slice 4) went
  the other way — computed, never stored. Comparing the two is the lesson: store what
  you must claim atomically; compute what you can derive.
