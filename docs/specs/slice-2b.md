# Slice 2b — Product Image Uploads (Cloudinary signed direct upload)

Status: ready-for-agent
Branch: `slice-2b-image-uploads`

## Problem Statement

As the store admin, the only way to put a picture on a product is to find an image
that is already hosted somewhere on the internet and paste its URL into the product
form. I cannot use my own product photos (they live on my computer, not on a URL),
pasted hotlinks can break or disappear at any time, and the workflow feels nothing
like a real store admin panel, where you drag a photo in and it just works.

## Solution

The product form gains a drag-and-drop upload zone (with a click-to-browse
fallback). Dropping or picking an image uploads it to Cloudinary — a free image
CDN — and the resulting permanent HTTPS URL is appended to the product's existing
image list automatically. The admin sees per-file upload progress and a preview,
exactly like the URL rows they already know. Pasting an external URL still works;
upload is an addition, not a replacement.

Under the hood this uses the **signed direct upload** pattern: the browser first
asks our backend (admin-gated) for a short-lived cryptographic signature, then
sends the file bytes **directly to Cloudinary** — they never pass through Render.
The Cloudinary API secret lives only on the backend; the browser never sees it.

## User Stories

1. As an admin, I want to drag an image file from my computer onto the product form, so that I can use my own product photos without hosting them somewhere first.
2. As an admin, I want to click the upload zone to open a file picker, so that I can upload even when drag-and-drop is awkward (e.g. small screen).
3. As an admin, I want to select multiple images at once, so that I can populate a product gallery in one action.
4. As an admin, I want to see upload progress per file, so that I know a large photo is still uploading and don't submit the form too early.
5. As an admin, I want each uploaded image to appear as a normal row in the existing image list (preview + URL + remove button), so that uploaded and pasted images behave identically after upload.
6. As an admin, I want a clear error message when an upload fails (network drop, bad file), so that I know to retry instead of silently losing the image.
7. As an admin, I want obviously wrong files (not an image, absurdly large) rejected before any upload starts, so that I don't waste time on a doomed upload.
8. As an admin, I want the form to stay fully usable while an upload runs, so that I can keep typing the description meanwhile.
9. As an admin, I want the submit button blocked while uploads are still in flight, so that I can't accidentally save a product missing its images.
10. As an admin, I want to remove an uploaded image row before saving, so that a mis-drop doesn't end up on the product.
11. As an admin, I want uploads to work on both the create and the edit product pages, so that the workflow is the same everywhere.
12. As an admin, I want to still be able to paste an external image URL, so that the old workflow keeps working for images already hosted elsewhere.
13. As a shopper, I want product images to load fast from a CDN, so that browsing the catalog feels snappy.
14. As a shopper, I want product pages to keep working exactly as before, so that this admin feature changes nothing about my experience.
15. As a malicious visitor, I must NOT be able to obtain an upload signature without an admin session, so that strangers cannot fill the store's media library.
16. As the store owner, I want the Cloudinary API secret to exist only on the server, so that nobody can forge signatures or abuse my Cloudinary account.
17. As the store owner, I want all uploads collected under one Cloudinary folder, so that the media library stays organized and recognizable.
18. As a developer, I want the automated tests to prove the signature is cryptographically correct without calling Cloudinary, so that the suite stays fast, free, and offline.

## Implementation Decisions

- **Pattern: signed direct upload.** The backend signs; the browser uploads
  straight to Cloudinary's upload API; the response's `secure_url` goes into the
  product's `images` array. File bytes never touch our backend. No change to the
  Product schema — `images: string[]` already holds URLs and doesn't care where
  they came from.
- **New endpoint: `POST /api/admin/uploads/signature`**, guarded by the existing
  `requireAuth` + `requireAdmin` chain (same as the other admin routes). Response
  body: `{ cloudName, apiKey, timestamp, folder, signature }`. 401 without a
  session, 403 for non-admins — identical contract to the other admin endpoints.
- **Signature algorithm (Cloudinary's documented scheme):** SHA-1 hex digest of
  the signed parameters serialized as `key=value` pairs, sorted alphabetically,
  joined with `&`, with the API secret appended. We sign exactly two parameters:
  `folder` and `timestamp`. Deterministic → independently verifiable in tests.
- **No new backend dependency.** The signature is one hash; Node's built-in
  `crypto` module computes it. The full Cloudinary SDK would add a dependency for
  one line of hashing.
- **Fixed upload folder** `sumon-express/products`, chosen by the backend (part of
  the signature, so the browser cannot change it).
- **Environment variables** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET` — required in `backend/.env` and the Render dashboard;
  read through the existing `requireEnv` helper. The test setup provides fake
  values (tests never call Cloudinary).
- **Frontend upload helper** lives beside the axios engine: fetches the signature
  via the authenticated `api` instance, then POSTs `multipart/form-data` (file +
  api_key + timestamp + folder + signature) to
  `https://api.cloudinary.com/v1_1/{cloudName}/image/upload` using **plain axios**
  — no Bearer header and no cookies may leak to a third party. Reports progress
  via axios's `onUploadProgress`; returns the `secure_url`.
- **Client-side pre-flight checks** before any bytes move: file must be an
  `image/*` type and ≤ 5 MB (under Cloudinary's free-tier 10 MB cap, generous for
  product photos). Violations show the row-level error message; nothing uploads.
- **ProductForm changes only** (both create and edit pages use it, so both gain
  uploads for free): a drop zone above the existing URL rows; each accepted file
  becomes an image row immediately (progress state → URL state on success, error
  state on failure); the existing stable-row-id mechanism is reused; submit is
  disabled while any upload is in flight.
- **UI copy stays in the existing admin visual language** (shadcn/ui, muted
  borders, destructive-color errors).

## Testing Decisions

- Good tests here assert **external behavior at the two existing seams** — the
  HTTP API and the component boundary — never implementation details (no
  spying on internal functions, no asserting on hash internals beyond the
  documented contract).
- **Backend (Supertest + in-memory Mongo, prior art: `tests/adminProducts.test.js`):**
  - unauthenticated → 401; authenticated non-admin → 403 (reuse `registerUser` /
    `registerAdmin` helpers);
  - admin → 200 with all five fields present, `timestamp` recent, `cloudName`/
    `apiKey` echoing the test env values;
  - **the signature check:** recompute the SHA-1 digest in the test from the
    response's `timestamp` + `folder` and the fake test secret; it must equal the
    returned `signature` byte-for-byte. This proves our signing implements
    Cloudinary's contract without any network call.
- **Frontend (Vitest + RTL, prior art: `tests/interceptor.test.ts` mocked-adapter
  pattern):** drive the upload helper / form with a mocked axios adapter —
  success path appends the `secure_url` to the image list; failure path surfaces
  an error and leaves existing rows untouched; non-image and oversized files are
  rejected with no upload request made. Mock adapters must reject non-2xx with a
  real `AxiosError` (lesson from Slice 1).
- **The real Cloudinary round-trip is manual:** one image uploaded through the dev
  UI against the real account, and one in production after deploy (this doubles as
  the version-distinguishing deploy probe for the slice, alongside the standard
  `404→401` probe on the new endpoint).

## Out of Scope

- Deleting assets from Cloudinary (removing an image row only removes the URL
  from the product; orphaned assets are acceptable on the free tier).
- Image reordering, cropping, transformations, or optimization presets.
- Uploads anywhere other than the admin product form (no avatars, no category
  images, no customer-facing uploads).
- Unsigned upload presets (weaker security model; rejected).
- Migrating existing hotlinked product images into Cloudinary.
- Rate limiting the signature endpoint (admin-only already; revisit in the
  hardening slice).

## Further Notes

- Cloudinary account is created and verified: cloud `ltwhehed`, credentials
  confirmed live via an authenticated ping (HTTP 200) on 2026-09-02. The same
  three variables must be added to the Render dashboard before this slice's
  deploy is verified.
- Signatures embed a timestamp; Cloudinary rejects ones older than ~1 hour, so a
  fresh signature is fetched per upload batch — they are cheap.
- The API secret must never appear in frontend code, git, or logs; `cloudName`
  and `apiKey` are public by design (visible in the browser's network tab).
