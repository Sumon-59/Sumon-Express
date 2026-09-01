# 04 — Create & edit form pages (frontend)

**What to build:** Creating and editing products in the browser: a "new product" page and
an "edit product" page sharing one form component — name, description, price, discount
price, stock, category dropdown (from the categories endpoint), and an ordered list of
image URLs with live previews. The form mirrors the server's validation rules for
immediate feedback; the server remains the authority. Saving lands back on the table.

**Blocked by:** 02 — Admin listing endpoint (parallel with 03).

**Status:** ready-for-agent

- [ ] Create round-trip: fill form → save → product appears in table and storefront
- [ ] Edit pre-fills every field and saves only what changed
- [ ] Image URL entries render live previews; broken URLs are visibly broken
- [ ] Client-side validation mirrors the server rules
- [ ] Frontend type check, tests, and build green
