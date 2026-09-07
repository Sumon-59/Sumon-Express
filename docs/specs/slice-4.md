# Slice 4 — Customers (aggregation pipelines)

Status: ready-for-agent
Branch: `slice-4-customers`

## Problem Statement

As the store admin, I know my products and my orders, but I don't know my
*customers*. There is no answer to "who are my best customers?", "who just placed
their first order?", or "what has this person bought before?" — the admin sidebar's
Customers link points at nothing. The data exists (every order references its
user), but nothing computes it into knowledge.

## Solution

The admin gets a real Customers section: a paginated table of every registered
customer with three computed columns — orders placed, lifetime spend, and last
order date — sorted biggest-spender-first by default (the page's reason to exist),
switchable to newest-customers-first. Clicking a customer opens a detail page:
who they are, their computed totals, and their full order history reusing the same
order rows the admin already knows. Cancelled orders count for nothing — a
customer whose every order was cancelled shows zero orders and ৳0.

## User Stories

1. As an admin, I want a table of all customers with order count, lifetime spend, and last order date, so that I can see who my business actually rests on.
2. As an admin, I want the table sorted by lifetime spend by default, so that "who are my best customers?" is answered by row one.
3. As an admin, I want to switch the sort to newest-first, so that I can watch new signups arrive.
4. As an admin, I want the table paginated, so that ten thousand customers don't render at once.
5. As an admin, I want cancelled orders excluded from every computed column, so that a serial canceller doesn't look like a VIP.
6. As an admin, I want customers with zero (kept) orders shown with 0 / ৳0 / —, so that the table is a census, not just a leaderboard.
7. As an admin, I want to open a customer's detail page, so that I can see their name, email, join date, and computed totals in one place.
8. As an admin, I want the detail page to list that customer's orders (all of them, cancelled included, with status pills), so that I can see their history exactly as the orders table shows it.
9. As an admin, I want to jump from a customer's order to the full order pipeline view, so that support questions ("where is my delivery?") are answerable in two clicks.
10. As an admin, I must NOT see admins listed as customers, so that staff accounts don't pollute the census.
11. As a non-admin, I must NOT be able to read the customer census or anyone's order history, so that personal data stays behind the admin gate.
12. As a shopper, I want nothing about my experience to change, so that this slice is invisible to me.
13. As a developer, I want the aggregation's numbers pinned by tests with known fixtures, so that a pipeline refactor can never silently corrupt the census.
14. As a developer, I want the three admin listings to share one pagination helper, so that page/limit behavior can't drift between them.

## Implementation Decisions

- **The census is computed in the database** with a MongoDB aggregation pipeline —
  users joined to their orders (`$lookup`), cancelled orders filtered out of the
  join, then collapsed per customer into `orderCount` (size of the kept set),
  `totalSpent` (sum of kept totals), and `lastOrderAt` (max kept creation date).
  Sorting and pagination run inside the same pipeline, so one page of finished
  rows is all that crosses the network. No JavaScript loops over full
  collections anywhere.
- **New endpoint: the admin customers listing** behind the established
  requireAuth + requireAdmin chain. Query params: `sort` = `spent` (default) |
  `newest`, plus the standard `page`/`limit`. Answers the standard wrapper
  `{customers, total, page, pages}`. Rows carry the user's id, name, email, join
  date, and the three computed columns. Users with role admin are excluded.
  Unknown `sort` values answer 400 (closed set, like the orders status filter).
- **New endpoint: the admin customer detail** — one customer's identity (name,
  email, join date) plus the same three computed numbers, 404 for a missing or
  admin id. It does NOT embed the order list.
- **Order history comes from the existing admin orders listing**, which gains a
  `user` filter (a valid ObjectId, else 400). Same wrapper, same rows, same
  newest-first — the customer detail page simply calls the orders listing
  filtered to one customer. No new order-history endpoint exists.
- **Prefactor first (scheduled in Slice 3's review, rule of three):** the
  page/limit parsing and `{page, pages, total}` math, hand-rolled identically in
  the products and orders listings, is extracted into one shared pagination
  helper; both existing listings adopt it (behavior unchanged, proven by the
  existing tests), and the customers listing is its third consumer.
- **Cancelled-orders rule, precisely:** an order with status `cancelled` never
  contributes to `orderCount`, `totalSpent`, or `lastOrderAt`. All other
  statuses (pending through delivered) count in full. `totalSpent` sums the
  orders' stored server-computed totals.
- **Frontend**: the Customers page (table: name/email, joined, orders, lifetime
  spend, last order; sort toggle; pagination — the established admin table
  look), and a customer detail page (identity card + totals + order history
  table with the shared status pills, each row linking into the Orders section).
  The sidebar's existing Customers link starts working. Errors via the shared
  error-message helper.

## Testing Decisions

- Good tests assert **computed numbers through the HTTP API against planted
  fixtures** — never by reading the database, never by inspecting pipeline
  stages (the pipeline is an implementation detail; the numbers are the
  contract).
- **Backend (Supertest + in-memory Mongo; prior art: the admin orders listing
  and pipeline tests, `placeOrder`/`plantProduct`/`registerAdmin` helpers):**
  - a census over known fixtures: two shoppers with differing order counts and
    totals — exact `orderCount`, `totalSpent`, `lastOrderAt` per row asserted;
  - the zero-order customer appears with 0 / 0 / null;
  - a cancelled order changes nothing in any computed column (cancel it through
    the API, re-read the census, numbers unchanged);
  - default sort is spend-descending; `sort=newest` orders by join date;
    unknown sort answers 400;
  - admins are absent from the census;
  - pagination wrapper + math (via the shared helper) and 401/403 on both new
    endpoints;
  - detail: correct numbers for one customer, 404 for unknown ids;
  - orders listing `user` filter: only that customer's orders, invalid id 400;
  - the prefactor is proven by the EXISTING product/order listing tests staying
    green after both adopt the shared helper.
- **Frontend: no component tests** (agreed seam decision) — the pages render
  server-computed numbers; verified in the browser during the demo.
- Deploy probe: the customers endpoint answering 401 in production (404 on old
  code), plus the census visible in the production admin UI.

## Out of Scope

- Customer search by name/email (text search arrives with its own slice-scale
  decisions later).
- Editing, deactivating, or deleting customers; role management from this UI.
- Anything shopper-facing (profiles, addresses, self-service history changes).
- Sortable table headers beyond the two named sorts; date-range filters.
- Caching or materializing the aggregates (computed live per request; fine at
  this scale).
- Emailing/exporting the census.

## Further Notes

- The census counts *registered* users with role user, whether or not they ever
  ordered — it is a census, not a leaderboard; the zero-order rows are the
  "signed up but never bought" signal, which is itself business information.
- `totalSpent` deliberately counts not-yet-delivered (pending/processing/shipped)
  orders: money committed, matching what the orders table shows. If a
  paid-vs-committed distinction is ever needed, that's a new column, not a
  redefinition.
- The aggregation must not multiply-count when a user has many orders (the
  classic `$lookup`-then-`$unwind` trap); the fixtures with multiple orders per
  customer exist precisely to catch this.
