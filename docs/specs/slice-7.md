# Slice 7 — Product Variants & Image Galleries

Status: ready-for-agent
Branch: `slice-7-variants`
Seam decision (full-autonomy contract): backend HTTP seam for the whole
variant/stock/pricing matrix; frontend cart-hook tests extended (the cart's identity
key changes — that's logic); the picker/gallery UI is browser-checked.

## Problem Statement

As the store owner I can't sell a t-shirt. Anything that comes in sizes or colors
forces me to create "T-shirt (S)", "T-shirt (M)", "T-shirt (L)" as three unrelated
products — three listings to maintain, three sets of images, and shoppers see clutter
instead of one product with a choice. And with only one image slot shown, the extra
photos I upload are invisible on the product page.

## Solution

A product can declare **one option axis** (e.g. "Size") with values that each carry
their own stock and an optional price override. The shopper picks a value on the
product page (sold-out values visibly disabled), the cart keeps different values as
different lines, the order snapshots the chosen value, and cancelling restores stock
to exactly the right value. The product page also gains a real gallery: thumbnails
under the main image, click to switch. Products without variants behave exactly as
they always have.

## User Stories

1. As an admin, I want to give a product an option axis with named values (S/M/L), so that one listing sells all sizes.
2. As an admin, I want each value to carry its own stock, so that M selling out doesn't hide S.
3. As an admin, I want an optional per-value price override, so that XL can cost more.
4. As an admin, I want products without variants untouched, so that my existing catalog keeps working unchanged.
5. As an admin, I want the products table to show total stock across values, so that the overview stays one number.
6. As a shopper, I want to pick my size on the product page and see its price and availability, so that I know what I'm buying.
7. As a shopper, I want sold-out values visible but disabled, so that I know M exists and is gone rather than never existed.
8. As a shopper, I must NOT be able to add a variant product to the cart without choosing a value.
9. As a shopper, I want S and M of the same shirt as separate cart lines with separate quantities.
10. As a shopper, I want my order and its history to show which value I bought.
11. As a shopper, I want a photo gallery with thumbnails on the product page, so that every uploaded image is reachable.
12. As the store owner, I want stock math per value to be exactly as safe as it is today — atomic claim, full rollback, cancel restores the right value.
13. As the store owner, I want ordering S and M of one shirt in a single order to work — the old one-line-per-product rule keys on product+value now.
14. As an attacker, I must NOT be able to order a value that doesn't exist, skip the value on a variant product, or send a value for a non-variant product — each a named 400.
15. As a developer, I want the variant stock matrix pinned through the HTTP API, including the mixed order (variant + plain product) rollback.

## Implementation Decisions

- **Schema (additive, back-compatible):** Product gains `optionName?: string` and
  `variants?: [{ name, stock, price? }]` — both absent on plain products, which keep
  today's behavior bit-for-bit. Multi-axis combinations (Size × Color) are out of
  scope by plan decision D7.
- **The sum invariant:** on a variant product, top-level `stock` equals the sum of
  value stocks. Order-time math maintains it with ONE atomic update per line — the
  guarded `$elemMatch` on the value's stock plus a dual `$inc` (value and top level)
  in the same operation on the same document; no two-step sync exists to drift.
  Admin writes (full-axis replace) recompute the sum server-side; client-sent
  top-level stock is ignored for variant products.
- **Admin editing is full-axis replace:** the update payload carries the whole
  variants array (like images); per-value patching is out of scope. The validation
  choke point gains the rules: optionName non-empty iff variants present, at least
  one value, unique names, per-value stock a non-negative integer, price override
  ≥ 0 when present.
- **Unit price resolution, pinned:** `variant.price ?? discountPrice ?? price` —
  a value override beats the product-level sale price; absent override, the sale
  price applies to every value.
- **Order lines:** the items input gains optional `variant` (the value name). On a
  variant product it is required and must name an existing value; on a plain
  product it must be absent — each violation a named 400. Line identity (the
  duplicate check) is product+variant. The item snapshot stores `variantName`, so
  history renders without lookups.
- **One stock engine:** claim and restore live in the shared order-items module —
  order creation's decrement/rollback and BOTH cancel paths (user and admin) call
  the same variant-aware helpers. Restore targets the snapshotted value; if the
  axis was replaced and the value no longer exists, restore falls back to the
  top-level counter alone (aggregate stock preserved; the per-value split is
  accepted as lost and this is the documented cost of renaming values with open
  orders).
- **Cart:** a line's identity is product+variant (`variant` stored on the item;
  legacy stored carts load as variant-less lines unchanged). Add-to-cart on a
  variant product requires a selection; the checkout payload carries `variant`
  per line.
- **Product page:** value picker (buttons; disabled + struck when that value's
  stock is 0), price and availability follow the selection; gallery = main image
  + clickable thumbnails (first image default). Admin form: optionName input and
  value rows (name/stock/price override) that replace the single stock input while
  the axis is on; order views append the value to the item name ("T-shirt · M").

## Testing Decisions

- **Backend (Supertest; prior art: the order/stock and validation tests):**
  - ordering a value decrements that value AND the top-level sum (public product
    endpoint proves both); other values untouched;
  - S and M of one shirt in one order; the old same-product duplicate check still
    fires for a repeated product+value pair;
  - refusals: missing value on a variant product, unknown value, value sent for a
    plain product, insufficient stock on the chosen value while another value has
    plenty — each a named 400 leaving all stock untouched;
  - price override charged (and discountPrice interplay pinned both ways);
  - mixed order (variant line + plain line) where the LAST line fails → every
    earlier decrement rolled back, variant and plain alike;
  - user cancel and admin cancel each restore the exact value (and the sum);
  - axis-replaced-then-cancel: restore lands on the top-level counter (the
    documented fallback);
  - validation choke point: every new rule a named 400; plain-product regression
    (create/update without variants unchanged);
  - order snapshot carries `variantName`; my-orders and admin listing expose it.
- **Frontend (Vitest + RTL):** cart-hook tests extended — same product different
  values = two lines, same value twice = quantity bump, remove/update by
  product+variant, legacy variant-less lines unaffected. Picker/gallery: browser.
- Deploy probe: create a variant product in production via the API, order flow
  untouched (no new endpoints — the probe is a version-distinguishing write:
  variants persisted and served back).

## Out of Scope

- Multi-axis combinations (Size × Color) — plan decision D7.
- Per-value images or galleries; per-value SKUs/barcodes.
- Per-value patch endpoints (full-axis replace only).
- Migrating any existing product to variants (admins opt in per product).
- Low-stock alerts per value; variant-level analytics.

## Further Notes

- The riskiest surface is the stock engine touching three call sites (create,
  user cancel, admin cancel). The whole point of the shared helper is that the
  variant logic exists once; the mixed-order rollback test is the tripwire.
- The gallery rides the existing `images: string[]` — Slice 2b's uploads feed it
  with zero changes.
