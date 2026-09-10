# 01 — The reviews engine: eligibility, uniqueness, honest averages

**What to build:** A delivered-order purchaser can rate (integer 1–5) and comment on
that product — once. In-pipeline, cancelled, never-bought, and anonymous callers are
refused with named errors. The author (only) can edit and delete their review. Every
write recomputes `ratingAvg`/`ratingCount` on the product from the Review collection —
visible immediately on the public product endpoint. Reviews list publicly under the
product (newest first, shared wrapper, name populated, email never). An authenticated
eligibility read answers `{canReview, alreadyReviewed}`. The one-review rule is a
compound unique index (E11000 → friendly 400 via the Slice 5 middleware).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Eligibility matrix: delivered 201; pending/shipped 403; cancelled 403; never-bought 403; anonymous 401
- [x] Duplicate review 400; unique index present as the race backstop
- [x] Rating validation: 0 / 6 / 3.5 / missing named 400s; comment cap enforced
- [x] Denormalization: create, second reviewer (5+2 → 3.5), edit, delete (to zero) — all proven via the PUBLIC product endpoint
- [x] Owner-only edit/delete (other user 403, unknown 404)
- [x] Listing: public, newest first, wrapper, name present, email absent
- [x] Eligibility read: all four states
- [x] All existing tests still green; typecheck clean
