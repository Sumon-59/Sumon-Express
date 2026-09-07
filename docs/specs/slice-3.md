# Slice 3 — Order Management (the status pipeline)

Status: ready-for-agent
Branch: `slice-3-order-management`

## Problem Statement

As the store admin, I can see that orders exist, but I can't *run* them. The admin
Orders page is a placeholder; the only way to move an order through its life
(pending → processing → shipped → delivered) is to call the API by hand. Worse, the
current status route has holes: nothing stops an order from moving *backwards*
(shipped → pending), and setting `status: "cancelled"` through it cancels the order
**without giving the stock back** — silently corrupting inventory. As the business
grows past a handful of orders, one flat unpaginated list also stops being usable.

## Solution

The admin gets a real Orders section: a paginated table with status pills and a
status filter, a detail drawer showing everything about one order (items, shipping
address, customer, totals), buttons that advance an order to its legal next
statuses only, and a cancel action (with confirmation) that restores stock. The
backend enforces the pipeline as a real state machine: statuses only move forward,
terminal states are locked, and cancellation happens only through the cancel
endpoint — the one place that knows to restore stock.

## User Stories

1. As an admin, I want a table of all orders newest-first, so that I see the latest business at a glance.
2. As an admin, I want each row to show customer name, date, item count, total, and a colored status pill, so that I can scan the pipeline without opening anything.
3. As an admin, I want to filter the table by status, so that I can work one queue at a time (e.g. everything `processing`).
4. As an admin, I want the table paginated, so that a thousand orders don't render in one page.
5. As an admin, I want to open an order's detail drawer, so that I can see its items (name, price, quantity), shipping address, phone, payment method, and customer.
6. As an admin, I want buttons that advance an order to its next status, so that I can drive pending → processing → shipped → delivered from the UI.
7. As an admin, I want only the *legal* next moves offered, so that I can't accidentally push an order backwards or resurrect a finished one.
8. As an admin, I want marking an order delivered to also mark it paid, so that cash-on-delivery orders settle in one click.
9. As an admin, I want to cancel a pending or processing order with a confirmation prompt, so that a misclick never kills a real order.
10. As an admin, I want cancellation to restore the stock of every item on the order, so that inventory stays truthful.
11. As an admin, I must NOT be able to cancel through the generic status route, so that no code path can cancel without restoring stock.
12. As an admin, I must NOT be able to change a delivered or cancelled order, so that completed history is immutable.
13. As an admin, I want a clear error message when a transition is refused, so that I understand the rule I hit.
14. As a shopper, I want the status my admin sets to show on my "my orders" page, so that I can follow my delivery.
15. As a shopper, I want stock from my cancelled order back on the shelf, so that items don't vanish from the store.
16. As a non-admin, I must NOT be able to list, advance, or cancel other people's orders through the admin endpoints, so that order data stays private.
17. As a developer, I want every pipeline rule expressed as one HTTP-level test, so that the state machine's contract is executable.

## Implementation Decisions

- **The state machine, pinned** (the heart of the slice):
  - Forward moves along `pending → processing → shipped → delivered` are legal,
    including skips (e.g. `pending → shipped`). Backwards moves are 400.
  - `delivered` and `cancelled` are terminal: any update attempt is 400 (already
    partially true today; now tested).
  - The generic status-update route **rejects `cancelled` and `pending` as
    targets** — `cancelled` only via the cancel endpoint (which restores stock);
    nothing ever returns to `pending`.
  - Reaching `delivered` sets `isPaid` / `paidAt` (existing behavior, kept).
  - Admin cancel is legal from `pending`/`processing` only — matching the
    documented user-cancel rule; a `shipped` order can only complete to
    `delivered`. Cancel restores each item's stock (existing mechanics) and
    stamps `cancelledAt`/`cancelledBy`.
- **Admin listing gains pagination + filtering**: `status` (one of the five, or
  omitted for all) and `page`/`limit`, answering `{orders, total, page, pages}` —
  the exact response shape the admin products listing already uses. Rows keep the
  populated customer (name, email) and embedded `items`. Sorted newest-first.
  This changes the endpoint's response from a bare array to the wrapper object;
  nothing in production consumes the old shape (the placeholder page renders
  static text).
- **No new detail endpoint.** Orders embed their items snapshot, so the drawer
  renders entirely from the row the listing already returned.
- **Frontend**: the placeholder Orders page becomes the real table (status pills,
  filter, pagination — same visual language as the products table), a detail
  drawer, and an actions area. The actions area is its own small component that
  maps a status to its legal actions (the UI mirror of the state machine) — kept
  separate so it can be tested in isolation. Errors surface via the existing
  shared error-message helper; confirmation uses the same confirm pattern as
  product deactivation.
- The status route continues to answer with the updated order; the cancel route
  keeps its message response.

## Testing Decisions

- Good tests assert **external behavior at the seams agreed for this slice**: the
  HTTP API for every business rule, plus one component test for the
  status→actions mapping. No spying on internals, no model-level assertions
  (models are for planting fixtures only, per the established convention).
- **Backend (Supertest + in-memory Mongo; prior art: existing order and admin
  product listing tests):**
  - the happy pipeline: pending → processing → shipped → delivered, and a legal
    skip (pending → shipped);
  - every refusal: backwards move, update on delivered, update on cancelled,
    `cancelled` via the status route, `pending` as a target, unknown status —
    each answering 400 with a message naming the rule;
  - delivered sets `isPaid`/`paidAt`;
  - admin cancel from pending and processing restores stock (asserted through
    the public product API); cancel on shipped/delivered/cancelled is 400;
  - listing: status filter, pagination math (`total`/`pages`), newest-first
    order, populated customer fields;
  - auth: 401 anonymous / 403 non-admin on every admin order route (helpers
    `registerUser`/`registerAdmin` as prior art).
  - Fixtures: orders planted through the public order-creation API where
    practical (a registered user + planted product), matching how existing order
    tests set up.
- **Frontend (Vitest + RTL; prior art: the upload component tests):** one test
  file for the actions component — for each status, exactly the legal actions
  render (pending: advance + cancel; processing: advance + cancel; shipped:
  deliver only; delivered/cancelled: none).
- The deploy probe for this slice: the reshaped admin listing (`{orders, total,
  page, pages}` instead of a bare array) is itself version-distinguishing, plus
  one real status advance through the production UI.

## Out of Scope

- Refunds, returns, or un-cancelling (no status ever leaves a terminal state).
- Editing an order's items, address, or totals after creation.
- Email/SMS notifications on status change.
- Customer search and customer profiles (Slice 4 owns customers).
- Text search over orders; date-range filters.
- Multi-document transactions (per-item stock restore with the existing guarded
  update pattern stays; accepted since Slice 2's decision log).
- Any change to how shoppers create or view their own orders beyond the status
  value they already display.

## Further Notes

- Accepted in review: re-setting an order's *current* status is refused as "not
  forward" (the spec pinned only backwards moves; no-op moves are refused in the
  same spirit and tested).
- Deferred in review (recorded since Slice 2): the pagination wrapper is now
  hand-rolled in two listings (products, orders). Slice 4 adds a third (customers)
  — extract the shared helper then, at the rule of three.

- Discovered while speccing: the pre-slice status route allowed backwards moves
  and — worse — `status: "cancelled"` without stock restore. Both are recorded
  above as explicit machine rules with dedicated refusal tests, so the hole can
  never quietly reopen.
- The status pill colors should reuse the badge look already established in the
  products table (green/neutral) extended with the pipeline's own hues; exact
  colors are a UI detail, not a contract.
