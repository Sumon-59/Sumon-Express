# Slice 13 — Transactional email

Status: ready-for-agent
Branch: `slice-13-email`
Seam decision (full-autonomy contract): backend HTTP seam with the mailer
FAKED at the mailer interface (an in-memory outbox — the payments-provider
philosophy applied to mail); no frontend changes beyond none at all. Deploy
probe via an admin mail-status diagnostic endpoint.

## Problem Statement

The store is silent. A shopper places an order and hears nothing; the order
ships and nothing says so; a cancellation vanishes without a trace. Every
serious store closes these loops by email — and badly-built email is worse
than none: a slow SMTP server must never make checkout hang, and a mail
failure must never turn a successful order into a 500.

## Solution

A **mailer abstraction** (the PaymentProvider pattern, applied to mail):
`sendMail({to, subject, text})` with three implementations — a recording FAKE
for tests (in-memory outbox), **Resend** over plain HTTPS for production
(no SDK — the Cloudinary/no-SDK house style; key optional), and a CONSOLE
mailer that logs the full email wherever no key is configured (dev sees
every mail in the server log; production-without-key stays functional).
Three order moments send mail — confirmation, status change, cancellation —
always **fire-and-forget**: the response never waits for mail, and a mailer
error is logged, never thrown.

## User Stories

1. As a shopper, I want an order confirmation email with my items, shipping and total, so that I have a receipt.
2. As a shopper, I want an email when my order's status changes (processing/shipped/delivered), so that I don't have to poll the site.
3. As a shopper, I want a cancellation email (whether I cancelled or the store did), so that the paper trail is complete.
4. As the store owner, I want checkout to succeed even when the mail service is down or slow, so that email can never cost a sale.
5. As a developer, I want every email moment pinned through the HTTP seam with a fake mailer, so that content and triggers can't silently regress.
6. As the operator, I want to see which mailer production is actually running (console vs resend), so that configuration is verifiable without reading logs.

## Implementation Decisions

- **The mailer interface** (`src/mail/mailer.ts`): `sendMail({to, subject,
  text})` → Promise<void>. `getMailer()` selects by env: test → the fake
  (`src/mail/fake.ts`, exported `outbox` array + a documented
  `failNext()` dial); `RESEND_API_KEY` set → Resend
  (`src/mail/resend.ts`, POST https://api.resend.com/emails with
  `MAIL_FROM` — default `Sumon Express <onboarding@resend.dev>` — 10s
  timeout, plain fetch); otherwise → console mailer (logs to/subject/text;
  never throws). **Optional external dependency**: a free Resend API key
  (Sumon's registration, the Cloudinary/SSLCommerz pattern) — the slice
  ships fully functional without it.
- **Fire-and-forget is the contract**: `src/mail/orderEmails.ts` exposes
  `notifyOrderPlaced(order, email)`, `notifyStatusChange(order, email)`,
  `notifyCancelled(order, email, by)` — each builds the text
  synchronously from the ORDER SNAPSHOT (items, shipping line, discount
  line, total — receipts doctrine: emails read the order, never re-read
  products/settings) and calls `mailer.sendMail(...).catch(log)`. No
  caller awaits delivery; a throwing mailer changes no response. Plain
  text only (HTML templates out of scope).
- **The three triggers**: createOrder (after the order exists — the email
  says what was actually created); updateOrderStatus (one email naming the
  new status; delivered mentions payment collected); both cancel doors
  (names who cancelled). Addresses: createOrder uses the session user's
  email; the admin routes populate the order's user.
- **The probe seam**: `GET /api/admin/mail-status` (requireAuth +
  requireAdmin) answers `{mailer: "fake"|"console"|"resend", from}` —
  version-distinguishing (absent in old code) AND config-proving (shows
  whether RESEND_API_KEY reached the runtime without leaking it).
- No queues, no retries, no delivery tracking — fire-and-forget with a
  logged error is the whole reliability story at this scale (documented
  trade-off; a real queue is a later slice if ever needed).

## Testing Decisions

- **Backend (Supertest + the fake outbox):**
  - placing an order sends exactly ONE email to the buyer: subject names
    the order, body carries item line(s), shipping label+fee, discount
    line when present, and the total;
  - status change → one email naming the new status; walking
    processing→shipped→delivered yields three;
  - user cancel and admin cancel each send one cancellation email (body
    says who cancelled);
  - **failure isolation**: with `failNext()` armed, placing an order still
    answers 201 and the order exists (the fake's rejection is logged,
    never thrown);
  - no email on refused orders (unknown shipping method → outbox empty);
  - mail-status: admin-only (401/403), answers `{mailer: "fake"}` under
    test.
- **Frontend**: no changes, no tests.
- **Deploy probe**: `GET /api/admin/mail-status` in production (absent in
  old code) — expected `{mailer: "console"}` until a Resend key lands in
  Render, `{mailer: "resend"}` after; both are version-distinguishing.

## Out of Scope

- HTML templates, branding, attachments, i18n.
- Queues, retries, dead-letter handling, delivery/open tracking.
- Marketing email, digests, admin notification emails.
- Email verification / password reset (Slice 14 owns auth mail).
- Nodemailer/Ethereal (a dependency for marginal dev value — the console
  mailer shows every mail in the dev log already).

## Further Notes

- Why fire-and-forget beats await-with-timeout here: the response's job is
  to report the ORDER's fate, and the order's fate does not depend on
  mail. Coupling them buys nothing but latency and false 500s.
- The fake's outbox is the same idea as the payments fake: tests assert
  through the real HTTP seam, and the double records what crossed the
  boundary — never re-implementing the real thing's semantics.
