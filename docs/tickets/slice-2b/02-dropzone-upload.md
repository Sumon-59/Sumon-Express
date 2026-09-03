# 02 — Drag-and-drop uploads in the product form

**What to build:** On both the create and edit product pages, the admin can drag image
files onto a drop zone (or click it to browse), select several at once, and watch each
file upload with visible progress. Each successful upload appears as a normal image row —
preview, URL, remove button — indistinguishable from a pasted URL row. Files that are not
images or exceed 5 MB are refused before any bytes move, with a clear message. A failed
upload reports its error without disturbing other rows. The submit button is disabled
while any upload is in flight so a half-uploaded gallery can't be saved. Pasting external
URLs keeps working unchanged.

Under the hood: the upload helper fetches a signature from ticket 01's endpoint through
the authenticated axios instance, then sends the file straight to Cloudinary with plain
axios — no Bearer header, no cookies to a third party — and resolves to the `secure_url`.

**Blocked by:** 01 — the signature endpoint is the contract this codes against.

**Status:** ready-for-agent

- [ ] Drag-and-drop and click-to-browse both accept files; multiple files upload in one action
- [ ] Per-file progress visible during upload; success lands the `secure_url` as a normal image row
- [ ] Non-image and >5 MB files rejected client-side with a message; no upload request is made (tested)
- [ ] Upload failure shows an error and leaves existing rows untouched (tested, mocked adapter)
- [ ] Success path appends the returned URL to the form's image list (tested, mocked adapter)
- [ ] Submit disabled while any upload is in flight
- [ ] Cloudinary POST goes through plain axios — no Authorization header, no credentials (tested)
- [ ] Manual demo: real photo dragged in dev, product saved, image visible on the storefront
- [ ] All existing tests still green; frontend build green
