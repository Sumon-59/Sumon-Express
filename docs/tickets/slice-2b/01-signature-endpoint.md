# 01 — The backend learns to sign uploads

**What to build:** An admin asking `POST /api/admin/uploads/signature` receives everything
the browser needs to upload one batch of images directly to Cloudinary: cloud name, API
key, a fresh timestamp, the fixed products folder, and a SHA-1 signature over the signed
parameters (folder + timestamp) computed with the API secret. Anyone without an admin
session is turned away exactly like on every other admin route. The secret itself never
leaves the server. Signing uses Node's built-in crypto — no new dependency. The test
environment provides fake Cloudinary credentials; real ones stay in `.env`.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Anonymous request → 401; authenticated non-admin → 403
- [x] Admin → 200 with `cloudName`, `apiKey`, `timestamp`, `folder`, `signature` all present
- [x] `cloudName`/`apiKey` echo the environment values; `timestamp` is current (unix seconds)
- [x] Signature recomputed in the test from the response's own `timestamp` + `folder` and
      the fake test secret matches the returned `signature` byte-for-byte
- [x] Missing Cloudinary env vars fail loudly (existing requireEnv behavior), not silently
- [x] All existing tests still green; typecheck clean
