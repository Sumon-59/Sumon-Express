---
slice: 1
title: Auth refactor (canonical JWT) + admin shell
status: ready-for-agent
date: 2026-08-27
decisions: [D1 revised, D3 canonical JWT, D9 branch workflow]
---

# Slice 1 — Auth Refactor + Admin Shell

## Problem Statement

The app runs two parallel authentication systems. Shoppers are authenticated by using the
7-day refresh cookie as a session everywhere, which means the short-lived access token the
backend already issues is decorative — and a stolen cookie is a 7-day skeleton key checked
only against the database copy. Admin routes use the opposite half: a Bearer access token
that no browser flow ever sends, so the admin API is unusable outside Postman and there is
no admin UI at all. Every protected route must know which of the two `req.user` shapes it
receives — a documented wart that has already caused confusion. The store owner cannot
manage products or orders from a browser, and the codebase teaches the wrong auth pattern.

## Solution

One authentication mechanism, the canonical JWT pattern: a 15-minute access token held
only in frontend memory and sent as a Bearer header on every API call, refreshed
invisibly via the httpOnly refresh cookie whenever it expires — an axios interceptor
retries the failed request once after refreshing, so users never notice. Every protected
backend route verifies the Bearer token with a single middleware that attaches one
consistent `req.user`. On top of this, the store owner gets a browser admin area: an
`/admin` layout with sidebar navigation and role-guarded access, with placeholder pages
that later slices fill with products, orders, customers, discounts, and analytics.

## User Stories

1. As a shopper, I want to stay logged in across visits and page reloads, so that I never re-enter my password just because a short-lived token expired.
2. As a shopper, I want token refresh to happen invisibly mid-session, so that a checkout begun at minute 14 still succeeds at minute 16.
3. As a shopper, I want logout to truly end my session everywhere, so that nobody with my old cookie can act as me afterwards.
4. As a security-conscious user, I want no auth token ever stored in localStorage, so that a script-injection attack cannot lift my credentials from storage.
5. As a security-conscious user, I want the refresh cookie rotated on every use and revocable server-side, so that a leaked cookie has the shortest possible useful life.
6. As the store owner, I want to log in with my normal account and open an admin area in the browser, so that managing the store no longer requires Postman.
7. As the store owner, I want the admin area to show a sidebar with Dashboard, Products, Orders, Customers, Discounts, and Settings sections, so that every later management feature has an obvious home.
8. As the store owner, I want a simple way to grant a user the admin role, so that I can create the first admin without editing the database by hand.
9. As a normal user, I want to be redirected away from `/admin` with no data flashing first, so that admin content is never shown to non-admins.
10. As an attacker probing the API, I want nothing — admin endpoints must answer 403 to authenticated non-admins and 401 to anonymous callers, so that the role boundary holds server-side regardless of the frontend guard.
11. As the developer, I want exactly one `req.user` shape attached by exactly one auth middleware, so that no route needs to know which auth flavor ran.
12. As the developer, I want the API client to expose one login/logout/refresh surface to the rest of the frontend, so that pages never touch tokens directly.
13. As a future contributor, I want the auth flow's edge cases (expired token, rotated-away cookie, revoked session, concurrent 401s) pinned by tests, so that refactors can't silently break login.

## Implementation Decisions

- **Access token (15 min, Bearer)** becomes the sole credential for protected routes,
  including the session-info endpoint. One middleware verifies it, loads the user, and
  attaches a single typed `req.user` (id, name, email, role). The old cookie-session
  middleware and the old id-string Bearer middleware are both retired; the type-level
  `SessionUser | BearerUserId` union collapses to one type.
- **Refresh token (7 days, httpOnly cookie)** keeps its current storage and rotation
  semantics: stored on the user record, rotated on every refresh, cleared and revoked on
  logout. The refresh endpoint is the only cookie-authenticated route.
- **Login and register** respond with the access token in the JSON body (as today) and
  set the refresh cookie; the frontend keeps the access token **in memory only** — never
  localStorage, never a readable cookie.
- **Axios interceptors**: a request interceptor attaches the Bearer header; a response
  interceptor catches 401s, performs **one single-flight refresh** (concurrent failures
  share the same refresh promise), retries each original request once, and signals logout
  if the refresh itself fails. Auth bootstrap on page load = call refresh once, then fetch
  the session user.
- **Admin area**: a dedicated layout with sidebar navigation (Dashboard, Products,
  Orders, Customers, Discounts, Settings) and a client-side role guard that renders
  nothing until the session is known, then redirects non-admins. Server-side, admin
  routes chain the unified auth middleware with a role-check middleware — the browser
  guard is UX, the server check is the security boundary.
- **Promote-to-admin**: a small script (run locally with tsx against the dev database, or
  against production deliberately) that sets a user's role by email.
- **Deferred-debt paydown from Slice 0.5** (recorded in the migration's deferred notes):
  the four hand-rolled token-verification sites collapse into one helper, and the
  backend's export styles unify while these files are being rewritten anyway.
- **Deploy note**: backend and frontend deploy together from one merge; during the
  minutes-long window where the new backend serves the old frontend, logged-in shoppers
  are treated as logged out until the new frontend loads. Accepted for a demo store.

## Testing Decisions

- A good test exercises the public seam and survives internal rewrites — this slice's
  seams were agreed as: the existing **HTTP-API seam** (the 17 tests continue, edited only
  where the contract genuinely changes: order routes authenticate with a Bearer header via
  the shared test helper), and **one new frontend seam, the axios interceptor**, tested
  against a mocked HTTP layer.
- New backend tests at the HTTP seam: refresh returns a working access token and rotates
  the cookie (the old cookie stops working); an expired or garbage access token gets 401;
  logout revokes so a subsequent refresh fails; admin endpoints give 401 anonymous, 403
  authenticated non-admin, 200 admin.
- New frontend tests at the interceptor seam: a 401 triggers refresh then a successful
  retry; refresh failure triggers the logout signal; N concurrent 401s cause exactly one
  refresh call.
- Prior art: the Slice 0 suites (Supertest + in-memory Mongo backend; Vitest + RTL
  frontend) and their setup files are the pattern to extend.

## Out of Scope

- Password reset, email verification, staff roles/permissions, session-device lists —
  all Slice 14 (auth hardening).
- Real content in the admin pages — Slices 2–6 fill the shell.
- Server-side route protection in Next (middleware-based guards) — client guard + server
  403s are this slice's contract.
- Token denylists/JTI tracking, multi-device refresh-token families.
- Request-body validation library (recorded in deferred notes).

## Further Notes

- The frontend auth context keeps its public surface (`user`, `loading`, `login`,
  `register`, `logout`, `checkAuth`) so pages change minimally; what changes is the
  engine underneath.
- Expected teaching moments: why memory beats localStorage for tokens, what an
  interceptor is, single-flight async patterns, the difference between UX guards and
  security boundaries.
