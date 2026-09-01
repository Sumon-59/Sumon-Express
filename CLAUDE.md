# CLAUDE.md — Sumon Express

Full-stack e-commerce app. Two independent apps in one repo, deployed separately:

- `backend/` — Express 5 + Mongoose 9 REST API in **strict TypeScript**, compiled with `tsc` to `dist/` (CommonJS output; production runs `node dist/server.js`). Deployed to **Render** (https://sumon-express-backend.onrender.com) — its build step runs `npm run build` (see `render.yaml`).
- `sumon-express-frontend/` — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + shadcn/ui. Deployed to **Vercel** (https://sumon-express.vercel.app) — the Vercel project's Root Directory setting points at this subdirectory (deliberately no root vercel.json).

Database: MongoDB Atlas — **production uses the `sumon_express` database (Render only); local dev uses `sumon_dev`** on the same cluster (set in `backend/.env`). Tests use an in-memory MongoDB and never touch Atlas.

## Commands

Backend (from `backend/`):
- `npm run dev` — start with tsx watch (port 5000, reads `backend/.env`)
- `npm run build` — compile TypeScript to `dist/` (what Render runs)
- `npm run typecheck` — `tsc --noEmit`, keep it clean
- `npm start` — production start (`node dist/server.js`; requires a build first)
- `npm test` / `npm run test:watch` — Vitest + Supertest integration tests (in-memory MongoDB via `mongodb-memory-server`; see `tests/setup.js`)
- `npm run seed` — seed demo products via tsx (requires at least one registered user; **wipes existing products**)

Frontend (from `sumon-express-frontend/`):
- `npm run dev` — Next dev server on port 3000
- `npm run build` — production build (fails on TS errors — keep it green)
- `npx tsc --noEmit` — quick type check
- `npm test` / `npm run test:watch` — Vitest + React Testing Library (jsdom)

Testing conventions: tests live in `tests/` in each app and assert only through public
seams (the HTTP API via Supertest on the backend; hooks/components on the frontend).
Backend test files stay JavaScript (ESM `import`) on purpose — they are the migration's
impartial safety net; Vitest transpiles them. `backend/app.ts` exports the Express app
(what tests mount); `backend/server.ts` is the runtime entry (dotenv + DB connect +
listen) — keep that split. In `server.ts`, `import "dotenv/config"` must stay the FIRST
import (app.ts reads `CLIENT_URL` at import time).

## Environment variables

Backend `backend/.env` (never commit; on Render set these in the dashboard):
- `PORT`, `NODE_ENV`, `MONGO_URI`
- `JWT_ACCESS_SECRET` — signs 15-min access tokens
- `JWT_REFRESH_SECRET` — signs 7-day refresh tokens
- `CLIENT_URL` — frontend origin, added to the CORS allowlist

Frontend `sumon-express-frontend/.env.local` (on Vercel set in dashboard):
- `NEXT_PUBLIC_API_BASE_URL` — e.g. `http://localhost:5000/api` locally, `https://sumon-express-backend.onrender.com/api` in prod. This is the **only** API URL var; the shared axios instance lives in `lib/api.ts`.

## Architecture notes

### Auth: one mechanism (canonical JWT, since Slice 1)
- **Access token** — 15-minute JWT signed with `JWT_ACCESS_SECRET`, returned in the login/
  register/refresh JSON body. The frontend keeps it **in memory only** (`lib/api.ts`) and
  sends it as `Authorization: Bearer` on every call. `requireAuth`
  (`middleware/requireAuth.ts`) verifies it on every protected route and attaches the one
  `req.user` shape (`SessionUser`: _id, name, email, role); handlers read it via the
  `sessionUser(req)` accessor. Admin routes chain `requireAdmin` (403 for non-admins).
- **Refresh token** — 7-day JWT with a unique `jti`, stored in the httpOnly cookie `jwt`
  AND on the user record. `GET /api/auth/refresh` (cookie-authed) rotates it and mints a
  new access token; reusing a rotated-away cookie fails. Logout clears the cookie and the
  stored token, so no new access tokens can be minted; outstanding access tokens die
  within 15 minutes (no denylist — accepted).
- **Frontend engine** (`lib/api.ts`): request interceptor attaches the Bearer header; the
  response interceptor does single-flight refresh on 401 and retries once. Only a
  definitive 401/403 from refresh logs the user out — transient errors (5xx, network,
  Render cold start) fail the one request without ending the session.
- All token verification goes through `verifyToken` in `utils/token.ts` — don't hand-roll
  `jwt.verify` at call sites.
- Promote an admin: `npm run promote -- <email>` (backend; acts on the `.env` database).

### CORS
Allowlist in `app.ts` (`allowedOrigins`) + `credentials: true`. When the frontend gets a new domain (e.g. a Vercel preview URL), it must be added there or via `CLIENT_URL`.

### Orders
- Order items are stored under `items` in `Order.model.ts` (embedded snapshot: product ref, name, price, quantity). The admin and user controllers both read `order.items`.
- `createOrder` computes `totalPrice` server-side from DB prices (`discountPrice ?? price`) — never trust client totals.
- Stock is decremented with a guarded atomic `findOneAndUpdate` (`stock: { $gte: qty }`, `$inc`) with manual rollback of prior decrements on failure; cancel restores stock the same way. There are no multi-document transactions.
- Cancellation allowed for status `pending`/`processing` only.

### Product management (since Slice 2)
- **Soft delete is the only delete.** `DELETE /api/products/:id` sets `isActive: false`;
  nothing is ever removed (order snapshots depend on it). Reactivate via
  `PUT /api/products/:id` with `isActive: true`.
- **`validateProductData` in `product.controller.ts` is THE validation choke point** for
  create and update — price ≥ 0, stock a non-negative integer, discount strictly below
  the *effective* price (partial updates validate against existing values), name/
  description non-empty, category a valid ObjectId. Violations answer 400 naming the
  field. Add new product rules there, nowhere else.
- **Admin catalog endpoints**: `GET /api/admin/products` (all statuses; `q`, `status`
  active|inactive|all, `page`/`limit`) and `GET /api/admin/products/:id` (returns
  inactive products — the public detail 404s them by design; the edit page needs this).

### Product pricing field
The field is `discountPrice`. (It was historically misspelled `discoutPrice` across backend + frontend; that's fixed — don't reintroduce the typo, and note old DB documents may still carry the misspelled field.)

### Frontend state
- `context/AuthContext.tsx` — backend is source of truth; every login/register is followed by `GET /auth/me`. `login`/`register` take a single object arg and return `Promise<void>`; errors are thrown (catch in the page).
- `context/CartContext.tsx` — cart lives in `localStorage` (`cart_items_v1`), never on the server. Checkout posts `{ items: [{product, quantity}], shippingAddress }`.
- Route guards are client-side `useEffect` redirects on `/checkout` and `/orders` (no Next middleware).

## Gotchas
- Express 5: async errors still go through `utils/asyncHandler.js` → `middleware/error.middleware.js`. Throw `Error` with `err.statusCode` set; don't call `res` after `next(err)`.
- Never `throw` inside a `jwt.verify` callback — use the synchronous `jwt.verify` return + try/catch (async callback throws become unhandled rejections).
- Render free tier sleeps; first request after idle takes ~30–60s. `/healthz` exists for uptime pings.
- `backend/.env` holds real Atlas credentials — it is gitignored via the root `.gitignore`; keep it that way.
- The seed script (`src/seed/products.seed.ts`) deletes ALL products before inserting, and points at whatever `MONGO_URI` is in `.env` — check before running against prod.
