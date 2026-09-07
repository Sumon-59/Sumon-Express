# 03 — The Customers UI: census table and customer detail

**What to build:** The sidebar's Customers link starts working. The census table shows
name/email, join date, orders, lifetime spend, and last order per row — biggest spender
first, a sort toggle for newest signups, paginated, in the established admin table look.
Clicking a customer opens their detail page: identity card, the three computed totals,
and their full order history (all statuses, shared status pills) via the user-filtered
orders listing, each order linking into the Orders section. Errors via the shared
error-message helper.

**Blocked by:** 02 — the UI renders the census API.

**Status:** ready-for-agent

- [ ] Census table wired to the listing: computed columns, sort toggle, pagination
- [ ] Zero-order customers render 0 / ৳0 / —
- [ ] Detail page: identity + totals + order history with status pills
- [ ] Order rows link into the Orders section
- [ ] Sidebar Customers link live
- [ ] Manual demo in dev: place orders as two shoppers, find the bigger spender on top, open them, walk their history
- [ ] All existing tests still green; frontend build green
