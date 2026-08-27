# CLAUDE.md — Sumon Express

Full-stack e-commerce app. Two independent apps in one repo, deployed separately:

- `backend/` — Express 5 + Mongoose 9 REST API in **strict TypeScript**, compiled with `tsc` to `dist/` (CommonJS output; production runs `node dist/server.js`). Deployed to **Render** (https://sumon-express-backend.onrender.com) — its build step runs `npm run build` (see `render.yaml`).
- `sumon-express-frontend/` — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + shadcn/ui. Deployed to **Vercel** (https://sumon-express.vercel.app). Root `vercel.json` points Vercel's build into this subdirectory.

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
- `JWT_ACCESS_SECRET` — signs 15-min access tokens (used by `utils/token.js` AND `middleware/auth.middleware.js` — keep them in sync)
- `JWT_REFRESH_SECRET` — signs 7-day refresh tokens
- `CLIENT_URL` — frontend origin, added to the CORS allowlist

Frontend `sumon-express-frontend/.env.local` (on Vercel set in dashboard):
- `NEXT_PUBLIC_API_BASE_URL` — e.g. `http://localhost:5000/api` locally, `https://sumon-express-backend.onrender.com/api` in prod. This is the **only** API URL var; the shared axios instance lives in `lib/api.ts`.

## Architecture notes

### Two auth mechanisms exist — don't mix them up
1. **Cookie auth (what the frontend uses).** Refresh token in an httpOnly cookie named `jwt`, signed with `JWT_REFRESH_SECRET`. `middleware/authCookie.middleware.js` (`protectCookie`) verifies it and attaches the full user doc as `req.user`. Used by `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout`, and all `/api/orders` routes.
2. **Bearer auth (admin/API-client only).** Short-lived access token from login/register responses, signed with `JWT_ACCESS_SECRET`. `middleware/auth.middleware.js` (`protect`) verifies the `Authorization: Bearer` header and sets `req.user` to the **userId string** (not a doc). `middleware/admin.middleware.js` (`isAdmin`) then loads the user and checks `role === "admin"`. Used by `/api/admin/*`, product/category create/update, `/api/users/profile`. The frontend ignores access tokens entirely — admin routes are exercised via Postman/curl.

Consequence: `req.user` is a **document** under `protectCookie` but a **string id** under `protect`. Check which middleware a route uses before touching `req.user`.

Cookie flags are env-dependent (`setRefreshCookie` in `auth.controller.js`): prod = `secure: true, sameSite: "none"` (cross-site Vercel→Render), dev = `secure: false, sameSite: "lax"`. `app.set("trust proxy", 1)` in `server.js` is required for this to work behind Render's proxy — don't remove it.

### CORS
Allowlist in `server.js` (`allowedOrigins`) + `credentials: true`. When the frontend gets a new domain (e.g. a Vercel preview URL), it must be added there or via `CLIENT_URL`.

### Orders
- Order items are stored under `items` in `Order.model.js` (embedded snapshot: product ref, name, price, quantity). The admin and user controllers both read `order.items`.
- `createOrder` computes `totalPrice` server-side from DB prices (`discountPrice ?? price`) — never trust client totals.
- Stock is decremented with a guarded atomic `findOneAndUpdate` (`stock: { $gte: qty }`, `$inc`) with manual rollback of prior decrements on failure; cancel restores stock the same way. There are no multi-document transactions.
- Cancellation allowed for status `pending`/`processing` only.

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
- The seed script (`src/seed/products.seed.js`) deletes ALL products before inserting, and points at whatever `MONGO_URI` is in `.env` — check before running against prod.
