# 01 — Settings engine: singleton model, choke-point validation, public read / admin write

**What to build:** `StoreSettings` model (all brand fields, defaults = today's
hardcoded look); the singleton access pattern (`findOneAndUpdate({}, …, upsert)`
for BOTH read-create and write — one helper, one document forever);
`validateSettingsData` choke point (hex accent, trims, caps, URL checks, named
400s); `GET /api/settings` public + `PUT /api/admin/settings` admin, partial
merge. TDD at the HTTP seam per the spec's test list.

**Blocked by:** nothing.

**Status:** ready-for-agent

- [ ] Model + defaults reproduce the current hardcoded brand
- [ ] Singleton pinned: one document after GET + concurrent/serial PUTs
- [ ] `validateSettingsData` matrix green (accent, caps, URLs, empties)
- [ ] Public GET / admin-only PUT with partial merge; auth matrix green
