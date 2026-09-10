# 01 — Variants in the schema and the one stock engine

**What to build:** A product can carry one option axis (optionName + values with own
stock and optional price override), validated at the choke point (named 400s; sum
recomputed server-side; plain products bit-for-bit unchanged). Ordering a value: the
line names its value (required iff the product has variants, must exist; line identity
is product+variant), price resolves `variant.price ?? discountPrice ?? price`, stock
claims are ONE atomic dual-$inc (value + top-level sum, same document), and the shared
helpers own claim/restore for order creation AND both cancel paths — cancel restores
the exact value, falling back to the top-level counter if the axis was replaced. The
item snapshot stores variantName.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Ordering a value decrements it AND the sum (public API proof); siblings untouched
- [x] S and M of one shirt in one order; duplicate product+value pair still refused
- [x] Named 400s: missing value, unknown value, value on a plain product, insufficient value stock (all stock untouched)
- [x] Price override charged; discountPrice interplay pinned both ways
- [x] Mixed order (variant + plain) failing on the LAST line rolls back every earlier decrement
- [x] User cancel and admin cancel restore the exact value and the sum
- [x] Axis-replaced-then-cancel restores the top-level counter (documented fallback)
- [x] Validation: every new rule a named 400; plain-product create/update regression green
- [x] Snapshot carries variantName; my-orders and admin listing expose it
- [x] All existing tests still green; typecheck clean
