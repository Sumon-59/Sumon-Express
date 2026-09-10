# Slice 11 — Online payments (SSLCommerz sandbox)

Status: ready-for-agent
Branch: `slice-11-payments`
Seam decision (full-autonomy contract): backend HTTP seam for the whole payment
state machine with the provider FAKED at the provider interface (the one seam
where a network gateway is stubbed — the same philosophy as the frontend's
axios-adapter fakes); frontend gets the checkout-payload test extended plus
browser checks. Real-gateway verification happens at deploy time with sandbox
credentials.

## Problem Statement

The store is cash-on-delivery only. Real Bangladeshi shoppers pay by card,
bKash, Nagad — and the store owner carries all the risk of unpaid deliveries.
Payments are also the first place where a security mistake costs actual money:
if the client can influence what "paid" means, someone will pay ৳1 for a ৳50,000
order.

## Solution

A `PaymentProvider` abstraction with **SSLCommerz sandbox** as the first real
implementation (one integration covers cards + bKash + Nagad — the realistic
path to going live in BD). Checkout offers COD or Online; online orders redirect
to the gateway's hosted page, and the order becomes paid ONLY when the
**server-verified IPN webhook** says so — never from the browser redirect,
never from client-sent numbers. Tampering with amounts client-side is
impossible because the server compares the gateway-verified paid amount against
its own stored total.

## User Stories

1. As a shopper, I want to choose Cash on Delivery or Online Payment at checkout, so that I can pay how I prefer.
2. As a shopper paying online, I want to be sent to a secure gateway page and returned to my order afterwards, so that I never type card details into the store itself.
3. As the store owner, I want an order marked paid ONLY when the gateway proves the money moved (verified webhook, amount matched), so that redirect spoofing and amount tampering are impossible.
4. As a shopper whose payment failed or was cancelled, I want the order to say so and remain payable, so that a hiccup doesn't strand my order.
5. As a shopper, I want payment status visible on my order (paid / awaiting payment / failed), so that I know where things stand.
6. As a developer, I want the entire pay/verify/tamper matrix pinned through the HTTP API with a fake provider, so that the security rules can't silently regress.

## Implementation Decisions

- **The trust boundary is the design**: the PROVIDER answers "what does the
  gateway say happened" (`verifyIpn` → `{verified, tranId, amount, status}`
  by asking the gateway's validator API server-to-server); the CONTROLLER
  decides "does that match MY order" (amount === totalPrice, tranId known,
  not already paid). Redirects style the UX; the webhook decides the money.
  `isPaid` has exactly two writers: delivered-COD (Slice 3) and the verified
  IPN handler — nothing else, ever.
- **`PaymentProvider` interface** (`src/payments/provider.ts`):
  `createSession(order, urls)` → `{redirectUrl}`;
  `verifyIpn(ipnBody)` → `{verified: boolean, tranId, amount, status}`.
  `getPaymentProvider()` selects by env: `sslcommerz` when
  `SSLCOMMERZ_STORE_ID`/`SSLCOMMERZ_STORE_PASSWD` are set; `fake` under test
  (tests drive the fake through documented IPN-body conventions). The fake
  mirrors the real contract exactly — it echoes what "the gateway" would
  attest, and the controller's checks stay identical for both.
- **SSLCommerz implementation** (`src/payments/sslcommerz.ts`): session via
  the sandbox `gwprocess/v4/api.php` (store creds + tran_id + amount + the
  four callback URLs + minimal customer fields); IPN verification via the
  **validator API** (`validator/api/validationserverAPI.php?val_id=…`) —
  the IPN body itself is NEVER trusted (anyone can POST a webhook); only
  the server-to-server validator answer counts, and only status
  VALID/VALIDATED with matching amount marks paid. Sandbox vs live base URL
  by `SSLCOMMERZ_SANDBOX` (default true).
- **Order model**: `paymentMethod` gains `"online"` (legacy instrument values
  remain valid on old documents; new checkout sends `cod` or `online`). New
  embedded `payment` subdoc (absent on COD orders): `{provider, tranId,
  status: "initiated"|"paid"|"failed", failureReason?}`. `tranId` is
  `<orderId>-<counter>` (unique per attempt, ≤30 chars per gateway rules);
  re-initiation after failure issues a fresh tranId — only the LATEST tranId
  is honored by the IPN handler (a late IPN for a superseded attempt is
  refused; no zombie payments).
- **Endpoints** (`/api/payments`, new routes file):
  - `POST /init` (requireAuth): `{orderId}` → must be the caller's order,
    `paymentMethod: "online"`, status `pending`, not paid → provider session
    → store `payment` (initiated) → `{redirectUrl}`. Named 400s otherwise.
    Re-init allowed while unpaid (retry after failure/abandonment).
  - `POST /ipn` (PUBLIC — the gateway calls it; there is no auth to give):
    look up the order by `payment.tranId`, `verifyIpn`, then the controller
    verdict: verified + amount matches → `isPaid`, `paidAt`,
    `payment.status: "paid"` (idempotent — a duplicate IPN changes nothing);
    verified but amount mismatch → `payment.status: "failed"` with reason
    `amount-mismatch`, order stays payable, 400 answered; unverified/failed
    gateway status → failed + reason; unknown tranId → 404. Never throws at
    the gateway: every outcome is an explicit response.
  - `POST /redirect/:outcome(success|fail|cancel)` (PUBLIC): SSLCommerz POSTs
    the shopper's BROWSER here (a Next page can't receive POST) → 303
    redirect to `CLIENT_URL/orders?paid=<outcome>&order=<id>` — pure UX,
    writes nothing, decides nothing. The order page shows truth from the API.
- **Frontend**: checkout gains a payment-method radio (COD default; Online =
  "card / bKash / Nagad via SSLCommerz"). Online flow: place the order (same
  endpoint), call `/payments/init`, `window.location.assign(redirectUrl)`.
  Orders list/detail show a payment badge driven by `isPaid`/`payment.status`
  (Paid / Awaiting payment / Payment failed — text + color, not color-only)
  and a "Pay now" retry button on unpaid online orders (re-init). The
  `?paid=` return query shows a transient notice ("verifying your payment…"
  on success — the webhook may land seconds later) and refetches.
- COD is untouched: no `payment` subdoc, delivered still sets `isPaid`
  (Slice 3 rule), the whole existing matrix keeps passing.

## Testing Decisions

- **Backend (Supertest, fake provider), the security matrix:**
  - init: anonymous 401; someone else's order 404; unknown order 404; COD
    order → named 400; already-paid → named 400; happy path → redirectUrl,
    payment initiated (visible on the order);
  - IPN verified + amount matches → order paid (GET shows isPaid, paidAt,
    payment.status paid);
  - **tampered amount** (gateway attests a different amount than totalPrice)
    → NOT paid, failed + amount-mismatch, 400;
  - unverified IPN (validator says invalid) → NOT paid;
  - gateway status FAILED/CANCELLED → payment.status failed, order payable;
  - unknown tranId → 404; **superseded tranId** (re-init then IPN for the
    old attempt) → refused, order not paid;
  - idempotency: duplicate valid IPN → paidAt unchanged, still one payment;
  - redirect endpoints: 303 with Location on CLIENT_URL for each outcome;
  - COD regression: the Slice 3 delivered-sets-isPaid test keeps passing.
- **Frontend**: extend the checkout payload test — choosing Online posts the
  order with `paymentMethod: "online"`, calls `/payments/init`, and navigates
  to the returned URL (navigation seam mocked). Badges browser-checked.
- **Deploy probe**: `/api/payments/init` exists in production (route absent in
  old code); with sandbox credentials set in Render, a real init answers a
  live `sandbox.sslcommerz.com` redirectUrl (proves credentials + gateway
  reachability). Completing a sandbox payment end-to-end (gateway test cards)
  is a manual demo folded into the probe when credentials exist. **External
  dependency**: SSLCommerz sandbox registration (store id + password) — only
  Sumon can register; the slice ships fully tested behind the fake provider
  and the env vars slot in later (the Cloudinary pattern from Slice 2b).

## Out of Scope

- Refunds, partial payments, payment capture/void flows.
- Stripe or any second provider (the abstraction exists; stretch goal only).
- Saved cards, wallets, subscriptions; currency other than BDT.
- Admin payment-reconciliation screens (the order drawer's badge suffices).
- Webhook signature schemes beyond the validator-API check (SSLCommerz's
  model IS validate-by-callback; there is no HMAC to verify).
- Auto-cancelling unpaid online orders after a timeout.

## Further Notes

- Why the IPN is public but safe: anyone can POST to it, but a forged body
  fails server-to-server verification, a replayed body is idempotent, and a
  superseded tranId is refused — the endpoint trusts the VALIDATOR, not the
  caller.
- Why amount is compared server-side: the session asks the gateway to charge
  `totalPrice`, but a shopper can tamper the gateway form; the validator
  reports what was actually paid, and only an exact match marks paid.
- The `payment` subdoc is the receipt of ATTEMPTS; `isPaid` stays the one
  paid-flag every existing surface already reads (COD and online converge).
