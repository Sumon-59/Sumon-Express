# Slice 0.5 — accepted deviations & deferred items

Recorded per the spec's "no logic changes — write it down" rule and the
code-review findings (2026-08-27).

## Accepted behavior deviations (all unreachable-in-practice edges)

- Login with a missing password now returns 401 (was: bcryptjs threw → 500).
- Missing JWT secrets now yield explicit 500s / clear errors (was: obscure
  jwt errors surfacing as 401/403). Only observable on a misconfigured server.
- `requireSessionUser` returns 401 if cookie routes ever run without a session
  user (was: TypeError → 500). Unreachable behind protectCookie.
- `PORT` is parsed with `Number(...) || 5000` (was: raw string; a pipe-path
  PORT is not a scenario on Render).
- Rate limiter uses `limit` (current API name) instead of deprecated `max` —
  identical behavior.
- TypeScript moved to production dependencies + `postinstall` build, so Render
  builds `dist/` even if the dashboard build command was never updated to
  match `render.yaml` (blueprint may not govern a dashboard-created service).

## Deferred to later slices

- **Slice 1 (auth refactor):** dedupe the four hand-rolled "check secret →
  jwt.verify → narrow" sites into one helper; unify the three export styles
  (`export =` / `export default` / named); retire the req.user duality.
- **Future slice:** replace `req.body as X` assertions with real runtime
  validation (e.g. zod) at the API boundary.
