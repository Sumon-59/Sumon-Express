# 01 — Search that finds, filters that mean it, related products

**What to build:** The public listing understands shoppers: `q` searches names AND
descriptions via the text index (name-weighted, relevance-ranked, regex fallback for
partials), `minPrice`/`maxPrice` compare the EFFECTIVE price (sale price when present;
inclusive bounds; bad bounds 400; min>max = empty page), `inStock=true` hides the
unbuyable, and everything composes with category, sort, and pagination. A related
endpoint answers up to 4 same-category active siblings (self excluded, empty for
uncategorized, 404 unknown). Inactive products surface nowhere.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Description-only word finds the product; name match outranks description match
- [ ] Partial prefix falls back to name regex and still finds
- [ ] Effective-price boundaries inclusive on the SALE price (both edges tested)
- [ ] Bad bounds 400; min > max answers an empty page
- [ ] inStock excludes zero-stock, keeps variant products with any value in stock
- [ ] Combined query (q + category + price + inStock) works in one request
- [ ] Related: same category, self/inactive excluded, cap 4, empty for uncategorized, 404 unknown
- [ ] All existing tests still green; typecheck clean
