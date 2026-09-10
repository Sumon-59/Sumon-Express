# 02 — Discovery UI: filter sidebar and recommendation strips

**What to build:** The products page gains a filter sidebar — category list, min/max
price inputs, in-stock checkbox — all URL-driven (filters survive reload, links are
shareable) and composing with the existing search box, sort, and pagination. The
product page appends a "Related products" strip; the cart appends "You may also like"
seeded by its first item. Both strips reuse the product card and vanish when empty.

**Blocked by:** 01.

**Status:** ready-for-agent

- [x] Filter bar (chips + price/stock row — deviation from "sidebar" recorded, matches established design): category, price range, in-stock — URL-driven, combined with q/sort/pagination
- [x] Clear-filters affordance; empty result state
- [x] Related strip on the product page; "You may also like" on the cart; both hidden when empty
- [x] All existing tests still green; frontend build green
