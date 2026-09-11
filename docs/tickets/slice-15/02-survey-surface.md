# 02 — Survey surface: low-stock listing + admin UI

**What to build:** `GET /api/admin/products/low-stock` (admin-only,
registered BEFORE `/admin/products/:id` to avoid param-route shadowing),
one row per plain product or low variant value, sorted ascending by stock,
threshold-0 short-circuits to an empty disabled response. Frontend: a
threshold field on the admin settings form; a "Low stock" panel on the
admin dashboard with distinct disabled/empty/populated states.

**Blocked by:** 01 (needs `lowStockThreshold` on settings).

**Status:** done

- [x] Endpoint returns plain-product rows + per-variant-value rows (never
      a product-level row for variant products)
- [x] Sorted ascending by stock; admin-only (staff/user refused)
- [x] Threshold 0 → `{threshold: 0, items: []}`, not a crash or 400
- [x] Route ordering verified against the `:id` shadowing gotcha
- [x] Settings form: threshold field, 0 labeled as disabling the feature
- [x] Dashboard panel: disabled / all-clear / populated states, browser-checked
