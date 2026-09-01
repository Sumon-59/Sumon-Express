---
slice: 2
title: Product management (admin catalog)
status: ready-for-agent
date: 2026-08-31
decisions: [D1 revised, D4 image URLs this slice, D9 branch workflow]
---

# Slice 2 — Product Management

## Problem Statement

The store owner has an admin area but cannot manage the catalog with it. Creating a
product still means hand-crafting a Postman request with a Bearer token; editing a price,
fixing a typo, or restocking means the same; and there is no way at all to see inactive
products, because the public listing hides them. The update and delete endpoints written
long ago sit disabled behind commented-out routes and have never been tested. Meanwhile
the storefront trusts whatever data reaches it — nothing stops a negative price or a
"discount" higher than the price from ending up on a product card.

## Solution

The admin Products section becomes a real catalog manager. The owner sees every product —
active and inactive — in a searchable, filterable, paginated table with stock and status
at a glance, creates new products and edits existing ones through one form (with live
image preview from pasted URLs), and deactivates or reactivates products with one click.
"Delete" is soft everywhere: a deactivated product disappears from shoppers instantly but
survives in the admin list and in past orders' snapshots. The server enforces the data
rules (no negative prices or stock, whole-number stock, discount strictly below price), so
bad data cannot reach the storefront no matter what client sends it.

## User Stories

1. As the store owner, I want a products table showing every product with thumbnail, price, discount, stock, and status, so that the whole catalog is visible at a glance.
2. As the store owner, I want to search my products by name from the table, so that I can find one item in a large catalog quickly.
3. As the store owner, I want to filter the table by status (active / inactive / all), so that I can review what shoppers currently see versus what is archived.
4. As the store owner, I want the table paginated, so that a growing catalog stays fast and navigable.
5. As the store owner, I want to create a product from a form — name, description, price, discount price, stock, category, image URLs — so that new items go on sale without Postman.
6. As the store owner, I want to edit any product with the same form pre-filled, so that fixing a price or restocking takes seconds.
7. As the store owner, I want a live preview of each image URL I paste, so that a broken link is visible before I save, not after shoppers see it.
8. As the store owner, I want to deactivate a product in one click, so that I can pull an item from sale immediately without losing its history.
9. As the store owner, I want to reactivate an archived product, so that seasonal or restocked items return without re-entry.
10. As the store owner, I want low stock visually highlighted in the table, so that I restock before selling out.
11. As a shopper, I want deactivated products to vanish from listings, search, and direct links, so that I can never order something the store no longer sells.
12. As a shopper with an old order containing a now-deactivated product, I want my order history intact, so that past purchases never disappear.
13. As the store owner, I want the server to reject negative prices, negative or fractional stock, and discounts at or above the price, so that data-entry mistakes cannot corrupt the storefront.
14. As an attacker or curious user without the admin role, I want nothing — the management endpoints must answer 401 anonymous and 403 non-admin, so that only the owner runs the catalog.
15. As the developer, I want the admin listing to reuse the established query patterns (search, filter, pagination) already proven on the public listing, so that the two stay consistent.

## Implementation Decisions

- **Soft delete is the only delete.** The existing active-flag semantics are kept and
  become reversible from the UI: deactivate hides a product from every public surface
  (listing, search, detail by id); reactivate restores it. No document is ever removed;
  order item snapshots keep working regardless.
- **A dedicated admin listing endpoint** returns all products regardless of status, with
  name search, status filter (active / inactive / all), pagination, and category
  populated — guarded by the unified auth middleware plus the admin role gate, like the
  existing admin order endpoints.
- **The dormant update and delete handlers come alive**: their routes are enabled behind
  the same guards. Delete stays a thin alias for deactivation; update accepts partial
  bodies (only provided fields change), matching its existing shape.
- **Validation is centralized server-side** and applied to both create and update: price
  must be a non-negative number, stock a non-negative integer, discount price (when
  present) strictly less than price, name and description required on create. Violations
  answer 400 with a message naming the offending field. Client-side, the form mirrors
  these rules for immediate feedback, but the server remains the authority.
- **Images stay pasted URLs this slice** (decision D4): the form manages an ordered list
  of URL strings with previews; drag-and-drop upload is Slice 2b.
- **Frontend structure:** the admin Products placeholder becomes the table page; create
  and edit are separate pages sharing one form component; category options come from the
  existing public categories endpoint. Row actions: edit, deactivate/reactivate (with a
  confirmation for deactivate).
- **API-client convention:** admin calls go through the same shared axios instance —
  the interceptor already handles auth; no new client machinery.

## Testing Decisions

- A good test observes behavior at a public seam and survives refactors. **Agreed seam:
  the HTTP API only** (the frontend table/form are thin UI over it; every rule they
  enforce is pinned server-side).
- New backend tests: admin products listing (401 anonymous / 403 non-admin / 200 admin;
  inactive products included; name search; status filter; pagination shape); the CRUD
  lifecycle as one story (create via API → edit → deactivate → absent from public listing
  and detail but present in admin listing → reactivate → visible publicly again);
  validation rejections (negative price, negative stock, fractional stock, discount equal
  to and above price) each answering 400.
- Existing tests are untouched — the public product endpoints' behavior does not change.
- Prior art: the admin role-boundary tests and the products listing tests from Slices 0–1;
  the shared register/plant helpers.

## Out of Scope

- Image uploads (Slice 2b — Cloudinary drag-and-drop).
- Category management UI (categories exist via API; a management screen can ride along a
  later slice).
- Product variants (Slice 7), reviews (Slice 9), bulk import/export, duplicate-product
  detection.
- Changing public storefront behavior — shoppers see exactly what they saw before.
- A request-validation library (deferred note from Slice 0.5 stands; validation here is
  hand-rolled and centralized).

## Further Notes

- The admin table deliberately mirrors the public listing's query vocabulary (search,
  filter, page/limit) so the two endpoints stay conceptually paired.
- Expected teaching moments: soft delete vs hard delete in commerce systems, partial
  updates (PATCH semantics over PUT), why validation lives server-side with the client
  only mirroring it.
