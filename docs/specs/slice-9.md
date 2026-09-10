# Slice 9 — Reviews & Ratings

Status: ready-for-agent
Branch: `slice-9-reviews`
Seam decision (full-autonomy contract): backend HTTP seam for the whole
eligibility/uniqueness/denormalization matrix; the stars and review UI are
rendering — browser-checked.

## Problem Statement

As a shopper I'm buying blind — no product carries any signal of whether previous
buyers were happy. As the store owner I have no social proof to show, and no feedback
loop from customers. And if reviews existed without rules, they'd be worthless: drive-by
ratings from people who never bought the product.

## Solution

Products carry star ratings and written reviews from **verified purchasers only** — you
review something only after an order containing it has been DELIVERED (can't review
what never arrived). One review per customer per product, editable and deletable by its
author. Every product shows its average rating and count — on cards, on the product
page — kept accurate by recomputation on every review write. The product page grows a
reviews section: the list for everyone, the form for eligible buyers.

## User Stories

1. As a shopper, I want stars and a count on product cards and the product page, so that quality is visible before I click.
2. As a purchaser whose order was delivered, I want to rate (1–5) and optionally write a comment, so that I can share my experience.
3. As a shopper who hasn't bought (or whose order isn't delivered yet, or was cancelled), I must NOT be able to review — with a message explaining why.
4. As a purchaser, I want exactly one review per product — editing my review, not stacking new ones.
5. As a reviewer, I want to edit or delete my own review, and nobody else's.
6. As a shopper, I want reviews newest-first with the reviewer's name and a "Verified purchase" badge, so that I can judge credibility.
7. As a shopper, I want the average to update immediately when reviews change, so that stars never lie.
8. As the store owner, I want deleted reviews to pull the average down/up honestly (recomputed, not remembered).
9. As a developer, I want the eligibility rule and the denormalized numbers pinned through the HTTP API, so that neither can silently regress.

## Implementation Decisions

- **Review model**: user + product refs, rating (integer 1–5), optional trimmed
  comment (cap 1000 chars), `verifiedPurchase: true` (stored although currently
  implied — the write rule may loosen someday; the badge reads the flag, not the
  rule), timestamps. **Uniqueness is a compound unique index** on user+product —
  the database enforces the one-review rule even against races (the E11000→400
  middleware mapping from Slice 5 covers the friendly error).
- **The eligibility rule, pinned**: a user may review product P iff they have at
  least one order with status `delivered` containing P (cancelled orders and
  in-pipeline orders don't count — delivery is the moment the product is truly
  theirs). Checked server-side at create time; named 403.
- **Denormalization by recomputation**: `ratingAvg` (1-decimal rounded) and
  `ratingCount` live on Product, recomputed from the Review collection after every
  create/update/delete — never incremented. (Contrast with Slice 5's usedCount,
  which must be CLAIMED atomically: store what you claim, recompute what you
  derive; a review write is not a race for a scarce slot, so recompute wins.)
- **Endpoints**: reviews listed publicly under the product (newest first, shared
  pagination wrapper, reviewer name populated — nothing else of the user);
  create under the product (auth + eligibility); update/delete by review id
  (owner-only, 403 otherwise, 404 unknown); an authenticated eligibility read
  answering `{canReview, alreadyReviewed}` so the UI shows the right thing
  without attempting writes. Rating validation: integer 1–5, named 400s;
  comment length capped.
- **Frontend**: a Stars display component (filled/empty by rounded average,
  count beside — text tokens, not color-only); cards and the product page show
  it when `ratingCount > 0`. The product page gains a Reviews section: list
  (name, stars, date, comment, Verified badge), and — per the eligibility
  read — the form (star picker + comment), edit/delete on the user's own
  review. Errors via the shared helper.
- Product API responses already carry the new fields automatically (schema
  defaults 0); no listing changes needed.

## Testing Decisions

- **Backend (Supertest; prior art: the variants and order matrices,
  `placeOrder` + status routes for fixtures):**
  - the eligibility matrix: delivered-order user 201; pending/shipped-order user
    403; cancelled-order user 403; never-bought 403; anonymous 401;
  - duplicate review 400 (and the unique index backstops a race);
  - rating validation: 0, 6, 3.5, missing → named 400s; comment cap;
  - denormalization: create → avg/count on the PUBLIC product endpoint; second
    reviewer → avg updates (worked example: 5 and 2 → 3.5); edit → recomputed;
    delete → recomputed (down to zero state);
  - owner-only: another user's edit/delete → 403; unknown review 404;
  - listing: public, newest first, wrapper shape, reviewer name present,
    email absent;
  - eligibility read: all four states (can, already, not-purchaser, anonymous 401).
- **Frontend**: no component tests (agreed seam) — browser check.
- Deploy probe: the reviews listing for a real product answers the wrapper in
  production (route absent in old code), and the product payload carries
  ratingAvg/ratingCount.

- Review-accepted asymmetry: authors can still edit/delete their review on a
  soft-deleted product (the listing 404s, the mutation works) — users keep control
  of their own words even on archived listings; the recompute is harmless.

## Out of Scope

- Review moderation/admin deletion, reporting, replies, photos.
- Helpfulness votes, sorting by rating, rating-distribution histograms.
- Backfilling "verified" from pre-slice orders beyond the delivered rule.
- Review-based product ranking or search boosts.
- Emails ("please review your purchase").

## Further Notes

- The unique index is the real one-review rule; the friendly 400 is UX. Slice 5's
  E11000 middleware mapping pays off again — the race loser gets a 400, not a 500.
- `ratingAvg` rounds to one decimal at write time; display rounds further as it
  likes. The stored value is for reading cheaply, the Review collection stays the
  source of truth — recomputation makes corruption self-healing on the next write.
