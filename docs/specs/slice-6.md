# Slice 6 — Analytics Dashboard

Status: ready-for-agent
Branch: `slice-6-analytics`
Seam decision (full-autonomy contract): backend HTTP seam carries all the numbers
(fixture-pinned, like the census); the dashboard UI is rendering of server-computed
values — browser-checked, no component tests.

## Problem Statement

As the store owner, opening the admin panel tells me nothing about how the store is
doing. The dashboard landing page is a stub; to answer "did I sell anything this week?"
I'd have to page through the orders table adding numbers in my head. I also have no
honest picture of money: an order that's merely placed is not the same as money
realized, and today nothing distinguishes them.

## Solution

The admin landing page becomes a dashboard that answers "how is my store doing?" at a
glance: stat tiles (realized revenue, pending value, total orders, customers, average
order value), a 30-day revenue chart distinguishing realized from pending money, order
counts by pipeline status, and the top products by quantity sold. Realized means
delivered; pending means in the pipeline; cancelled orders count for nothing anywhere —
the same one-rule discipline as the census.

## User Stories

1. As the store owner, I want a realized-revenue tile (delivered orders), so that I know money actually earned.
2. As the store owner, I want a pending-value tile (pending/processing/shipped), so that I know money in flight — clearly labeled as not yet realized.
3. As the store owner, I want total order and customer counts and the average order value, so that the scale of the store is one glance.
4. As the store owner, I want a 30-day daily revenue chart with realized and pending distinguishable, so that I can see momentum, not just totals.
5. As the store owner, I want order counts per pipeline status, so that I can spot a clogged stage (fifty orders stuck in processing).
6. As the store owner, I want the top products by quantity sold, so that I know what to restock and promote.
7. As the store owner, I want cancelled orders excluded from every metric, so that churn never inflates performance.
8. As the store owner, I want new-customer signups for the last 30 days, so that growth is visible next to revenue.
9. As a non-admin, I must NOT be able to read any analytics, so that business numbers stay private.
10. As a developer, I want every number pinned by a fixture test through the HTTP API, so that a pipeline refactor can never silently corrupt the dashboard.

## Implementation Decisions

- **One endpoint answers the whole dashboard** in a single response (one request, one
  loading state): overall totals, the 30-day daily series, status counts, top products,
  and 30-day new-customer count. Admin-gated like every sibling.
- **Vocabulary, pinned:** *realized* = orders with status `delivered` (delivery marks
  paid since Slice 3); *pending value* = statuses `pending`/`processing`/`shipped`;
  `cancelled` contributes to nothing. Tiles are all-time; the chart is the last 30
  days (UTC day buckets). Average order value = all-time non-cancelled revenue ÷
  non-cancelled order count, floored to whole taka for display consistency.
- **Computed in the database** with a handful of aggregations run in parallel: status
  grouping (counts + sums feed both tiles), the daily series via date-bucketing on
  creation date with conditional sums for realized vs pending, top products by
  unwinding the order-items snapshots (name comes from the snapshot — no product
  lookup, deliberately: the name at sale time is the honest one) and summing
  quantities, top 5. New customers = role-user signups in the window. No JavaScript
  loops over full collections.
- **Order date semantics:** the daily series buckets by order *creation* date — the
  day the sale happened — with the order's CURRENT status deciding which line it
  feeds. An order delivered today but placed Tuesday moves Tuesday's money from
  pending to realized; history is re-read, not appended. Simple, and matches how the
  tiles work; revisit only if immutable daily ledgers are ever needed.
- **Frontend:** the admin dashboard landing page replaces its stub — stat tiles,
  the 30-day chart (dataviz discipline applies; realized and pending must be
  distinguishable without color alone), status breakdown, top-products list. All
  numbers arrive from the one endpoint; the page computes nothing.

## Testing Decisions

- Prior art: the census tests — plant a known world, assert exact numbers through the
  HTTP API, never inspect pipeline internals.
- **Backend (Supertest + in-memory Mongo):** a fixture world with orders in every
  status (driven through the real status routes): realized counts only delivered;
  pending value sums exactly the in-pipeline statuses; cancelled orders (cancelled
  through the API, so stock/usage side effects fire) appear in no metric; status
  counts exact; top products ordered by quantity with the snapshot name; the daily
  series carries today's bucket with the right realized/pending split; discounted
  orders contribute their DISCOUNTED totals (regression tie to Slice 5); customers
  and 30-day signups exact; 401/403.
- **Frontend:** no component tests (agreed seam) — browser check.
- Deploy probe: the endpoint 404 → 401 in production, then an authenticated read
  returning believable totals over the real production data.

## Out of Scope

- Date-range pickers, per-category breakdowns, CSV export.
- Discount-campaign revenue impact (the usage counts on the discounts table remain
  the campaign view for now).
- Caching/materialized snapshots — computed live per request, fine at this scale.
- Timezone configuration (UTC buckets; Dhaka display can come with a settings slice).
- Real-time updates; the dashboard refreshes on load.

## Further Notes

- This is the Slice 4 aggregation lesson with a time axis: same $match/$group
  discipline, plus conditional accumulation (a sum that counts a document only when
  its status qualifies) and calendar bucketing.
- The top-products list reads item snapshots, so products renamed or deactivated
  since the sale still report honestly — the snapshot philosophy paying out again.
