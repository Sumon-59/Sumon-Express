# Slice 8 — Search, Filters & Recommendations

Status: ready-for-agent
Branch: `slice-8-search-filters`
Seam decision (full-autonomy contract): backend HTTP seam for the search/filter/
related matrix; the sidebar and recommendation strips are rendering — browser-checked.

## Problem Statement

As a shopper I can't find things. Search only matches product names by raw substring
(searching "comfortable" finds nothing even when a description says it), there is no
way to see only what I can afford or only what's in stock, and every product page is
a dead end — nothing suggests what else the store has.

## Solution

The catalog becomes navigable: search looks through names AND descriptions with
relevance ranking (best matches first, partial typing still works), a filter sidebar
narrows by category, price range, and availability — with prices meaning what the
shopper pays (sale prices, not sticker prices) — and both the product page and the
cart suggest related products from the same category.

## User Stories

1. As a shopper, I want search to match words in descriptions, so that "cotton" finds the shirt whose description says so.
2. As a shopper, I want the best matches first, so that searching "shirt" ranks the shirt above a mug that mentions shirts.
3. As a shopper, I want partial typing to keep working ("shir" → shirt), so that search feels live, not pedantic.
4. As a shopper, I want a price range filter that respects sale prices, so that "under ৳500" includes the ৳600 item on sale for ৳450.
5. As a shopper, I want an in-stock-only filter, so that I don't fall in love with what I can't buy.
6. As a shopper, I want filters and search to combine, so that "in-stock electronics under ৳2000 matching 'headphone'" is one query.
7. As a shopper, I want related products on a product page (same category, never the product itself), so that browsing continues naturally.
8. As a shopper, I want "you may also like" on my cart, so that I'm reminded of matching items before checkout.
9. As a shopper, I want inactive products invisible in search, filters, and recommendations, so that dead listings never surface.
10. As a developer, I want the filter math and search behavior pinned by fixture tests, so that ranking and effective-price logic can't silently regress.

## Implementation Decisions

- **Text index** on name + description with name weighted heavily (name matches
  outrank description matches). Search strategy, pinned: run `$text` first
  (stemmed, weighted, relevance-sorted via textScore); when it matches nothing,
  fall back to the existing case-insensitive name regex so partial words keep
  working. One resolver owns this — the listing endpoint's behavior, not two
  endpoints.
- **Effective-price filtering**: `minPrice`/`maxPrice` compare against
  `discountPrice ?? price` computed in the query (aggregation-style `$expr` with
  `$ifNull`) — never against the sticker price. Non-numeric bounds are 400;
  min > max returns an empty page, not an error (a legal empty range).
- **`inStock=true`** filters `stock > 0` (the variant sum makes this correct for
  variant products for free). Any other value of the param is ignored (an opt-in
  flag, not a tri-state).
- **Related products**: a dedicated endpoint on the product — same category,
  active only, excluding self, newest first, capped at 4. A product with no
  category answers an empty list (never "random products"). 404 for
  unknown/inactive ids, same as the public detail.
- **Frontend**: the products page gains the filter sidebar (category list, min/max
  price inputs, in-stock checkbox — all URL-driven so filters survive reload and
  are shareable); the product page appends a "Related products" strip; the cart
  page appends "You may also like" seeded by the first cart item (its product's
  related list). Product cards are reused everywhere; empty strips render nothing.
- All of this composes with the existing public listing (sort options, pagination)
  — no new listing endpoint.

## Testing Decisions

- **Backend (Supertest; prior art: the public products tests):**
  - description match: a word only in a description finds the product;
  - ranking: a name match outranks a description match for the same term;
  - partial fallback: a prefix that `$text` can't match still finds by name;
  - effective price: a product on sale is included/excluded by the SALE price at
    both boundaries (inclusive), sticker price irrelevant;
  - bad bounds 400; min > max = empty page;
  - inStock excludes zero-stock, includes variant products with any value stock;
  - combined query: search + category + price + inStock all at once;
  - related: same category only, self excluded, inactive excluded, cap respected,
    empty for uncategorized, 404 unknown id;
  - inactive products invisible in every path (regression tie to soft delete).
- **Frontend**: no component tests (agreed seam) — browser check.
- Deploy probe: the related endpoint 404 → 200/404-semantics in production
  (old code has no such route), plus a production search with a description-only
  word returning the product.

## Out of Scope

- Search suggestions/autocomplete, typo tolerance, synonyms.
- Cross-category or behavior-based ("customers also bought") recommendations —
  same-category is the whole algorithm.
- Faceted counts ("Electronics (12)"), filter analytics.
- Admin-side search changes (the admin q filter stays regex-only).
- Elasticsearch or any external search service.

## Further Notes

- The teach moment: `$text` is an INDEX (stemming, weights, relevance, fast) while
  regex is a SCAN (partial matches, no ranking, fine at small scale). The hybrid
  uses each for what it's good at, and the tests pin both behaviors so the
  trade-off stays visible.
- Effective-price filtering is the slice's trap: filtering stored `price` looks
  right until the first sale, then silently lies. The `$ifNull` expression is the
  one-line fix; the boundary tests are the tripwire.
