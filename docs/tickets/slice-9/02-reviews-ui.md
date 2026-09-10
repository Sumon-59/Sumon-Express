# 02 — Reviews UI: stars everywhere, the reviews section

**What to build:** Product cards and the product page show a Stars display (rounded
average + count, hidden at zero reviews). The product page gains a Reviews section:
the list (name, stars, date, comment, Verified purchase badge, newest first, load-more
via the wrapper) for everyone; for eligible buyers (per the eligibility read) a form
with a star picker and comment box; the author sees edit/delete on their own review.
Refusals and failures surface via the shared error helper.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Stars component (text + filled stars, not color-alone) on cards and product page; hidden when no reviews
- [ ] Reviews list with Verified badge; eligibility-driven form; own-review edit/delete
- [ ] All existing tests still green; frontend build green
