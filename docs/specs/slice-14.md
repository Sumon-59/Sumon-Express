# Slice 14 — Auth & authorization hardening

Status: ready-for-agent
Branch: `slice-14-auth-hardening`
Seam decision (full-autonomy contract): backend HTTP seam for the whole
threat matrix (reset tokens, role boundaries, notification triggers — the
mail fake from Slice 13 reads the emails); frontend pages (forgot/reset
password, account page, staff-aware admin nav) browser-checked plus the
existing interceptor tests untouched.

## Problem Statement

Three real security gaps. (1) A forgotten password is a dead account — and
the production admin password is weak with no way to rotate it from the
product. (2) Authorization is binary: anyone who helps run the store gets
FULL admin (settings, discounts, analytics) or nothing — Shopify solves this
with staff roles. (3) Logins are silent: an account takeover leaves no
trace the owner would ever see.

## Solution

Password reset by emailed one-time token (hashed at rest, single-use,
expiring, no user enumeration); authenticated password change; a login
notification email on every successful sign-in; and a third role — `staff` —
who can manage ORDERS and nothing else, enforced by a single permission
door on the admin router. Every credential change revokes the refresh
token, so a stolen session dies when the password does.

## User Stories

1. As a user who forgot their password, I want an emailed reset link that works once and expires, so that I can recover my account safely.
2. As an attacker probing /forgot-password, I must NOT learn which emails exist (same answer either way).
3. As a signed-in user, I want to change my password by proving the current one, so that rotation is routine.
4. As a user whose password just changed (either way), I want other sessions logged out and a confirmation email, so that a thief doesn't ride along.
5. As a user, I want an email when my account signs in, so that a takeover is visible immediately.
6. As the store owner, I want to grant an employee ORDER management without settings/discounts/products/analytics access, so that operational help doesn't mean total control.
7. As a staff member, I must be refused (named 403) on every admin surface except orders.
8. As a developer, I want the whole threat matrix pinned at the HTTP seam, so that none of it can silently regress.

## Implementation Decisions

- **Reset tokens — hash at rest, the password rule applied to tokens**:
  `POST /api/auth/forgot-password {email}` ALWAYS answers the same 200
  ("If that account exists, an email is on its way") — no enumeration. For
  a real user: 32 random bytes hex; the SHA-256 of it is stored
  (`resetTokenHash`, `resetTokenExpires` = now+1h) — a DB leak exposes no
  usable token; the raw token rides an email link
  (`CLIENT_URL/reset-password?token=…`, CLIENT_URL via the payments
  clientUrl logic — extract it to `utils/clientUrl.ts` and reuse). A new
  request overwrites the old token (last one wins).
  `POST /api/auth/reset-password {token, password}` hashes the input,
  matches + checks expiry (one named 400 for invalid-or-expired — no
  distinguishing), sets the password (existing hashing), CLEARS the token
  fields, REVOKES the stored refresh token (every session dies), sends a
  "your password was changed" email. Single-use by construction (cleared
  on success).
- **Password change**: `PUT /api/auth/password {currentPassword,
  newPassword}` (requireAuth) — verify current (named 400), apply the SAME
  password policy as register (min 6 — checked against the existing rule
  at implementation time and mirrored, not reinvented), set, revoke the
  stored refresh token, then issue a FRESH refresh cookie + access token
  in the response (the current session continues; every other session
  dies) — the login issuance path reused, not duplicated. Confirmation
  email here too.
- **Login notification**: on every successful `POST /api/auth/login`, a
  fire-and-forget email (Slice 13 dispatch — throw-proof) with the time
  and the request's user-agent. No geo/IP enrichment (out of scope).
- **RBAC — one permission door**: `User.role` gains `"staff"`.
  `requireRole(...roles)` in `middleware/requireAuth.ts` generalizes
  `requireAdmin` (which becomes `requireRole("admin")` — same export, no
  call-site churn). The admin ORDERS routes (list, status, cancel) accept
  `staff` OR `admin`; every other admin route stays admin-only. The rule
  lives in the ROUTER (one file audits the whole permission map), not
  scattered in controllers. Role management:
  `PUT /api/admin/customers/:id/role {role: "user"|"staff"}` (admin-only;
  closed set — an admin cannot mint another admin over HTTP, promotion to
  admin stays the CLI script; self-demotion refused 400).
- **Frontend**: `/forgot-password` (email form → the constant message),
  `/reset-password` (reads ?token, new password twice, posts, routes to
  login), `/account` page (change password form; navbar menu entry), admin
  nav filtered by role (staff sees Orders only; the layout guard accepts
  staff for /admin/orders, admin for the rest — server still enforces),
  customers detail gains a role select (user/staff) for admins.
- Census note: the customer census excludes role "admin" today — staff
  REMAIN in the census (they are humans who may also shop); their row
  shows the role.

## Testing Decisions

- **Backend (Supertest + the mail fake):**
  - forgot-password: same 200 + same body for existing and unknown email;
    existing → exactly one email whose text carries a token link; unknown
    → outbox empty;
  - reset-password: the emailed token (parsed from the fake outbox)
    resets the password — old password refused at login, new accepted;
    the token is single-use (second attempt → named 400); a garbage token
    → the same named 400; an expired token → same 400 (expiry forced via
    the model — fixture, not a wait); reset revokes the refresh cookie
    (the old cookie's /refresh fails);
  - change password: wrong current → named 400, nothing changes; happy
    path → old refused/new accepted at login, response carries a fresh
    accessToken, confirmation email sent; weak new password → the
    register rule's named 400;
  - login notification: successful login → one email (subject mentions
    sign-in); failed login → nothing;
  - RBAC matrix: staff can GET /api/admin/orders, PUT status, cancel;
    staff 403s (named) on settings PUT, discounts, products, customers,
    analytics, uploads, mail-status; user 403s on orders; admin unchanged
    (spot-check); role route: admin sets user→staff→user; role "admin" →
    400; self-demotion → 400; staff cannot set roles;
  - regression: the full existing auth suite untouched and green.
- **Frontend**: browser-checked pages; no new component tests (forms are
  thin posts; the seam decision).
- **Deploy probe**: `/api/auth/forgot-password` answers the constant 200
  in production (route absent in old code); the RBAC probe: the
  production admin's token still reaches an admin-only surface
  (mail-status) — proving requireAdmin's generalization changed nothing.

## Out of Scope

- Email verification on signup (friction without a fraud problem to
  solve at this scale; the reset flow proves address ownership when it
  matters — revisit if abuse appears).
- Session/device LIST with per-device revocation (the user model stores
  ONE refresh token — a device list means a sessions collection;
  password change/reset already revokes globally, which is the security
  half of that feature).
- Per-permission staff customization, admin-mint-admin over HTTP, audit
  logs, 2FA, rate limiting beyond what exists.
- Password strength meters/zxcvbn; geo/IP lookup in login mails.

## Further Notes

- Threat-model notes baked in: tokens hashed at rest (DB leak ≠ account
  takeover), constant responses (no enumeration), single-use + expiring
  (replay window minimized), global revocation on credential change
  (stolen-session containment), staff scoping (blast-radius reduction),
  closed-set role writes (no privilege-escalation route over HTTP).
- `requireAdmin` as `requireRole("admin")` keeps every existing call
  site and test meaning exactly what it meant — the generalization is
  additive.
