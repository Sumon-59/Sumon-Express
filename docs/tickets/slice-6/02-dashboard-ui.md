# 02 — The dashboard: the admin landing page answers "how is my store doing?"

**What to build:** The admin dashboard stub becomes the real landing page: five stat
tiles (realized revenue, pending value — clearly labeled, orders, customers, avg order
value), the 30-day revenue chart with realized and pending visually distinguishable
(not by color alone), the per-status order breakdown, and the top-products list. One
request, one loading state, every number server-computed. Dataviz discipline applies
to the chart.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Stat tiles with honest labels ("Pending value" ≠ revenue)
- [ ] 30-day chart: realized vs pending distinguishable without color alone; empty days render as zero, not gaps
- [ ] Status breakdown + top-products list
- [ ] Loading and error states via the established patterns
- [ ] All existing tests still green; frontend build green
