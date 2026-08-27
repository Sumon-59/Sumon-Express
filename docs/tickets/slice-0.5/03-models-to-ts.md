# 03 — Models → TypeScript

**What to build:** All four Mongoose models (User, Product, Category, Order) typed with
document interfaces, so that reading or writing a field that doesn't exist on a model is a
build error — the permanent vaccine against the `discoutPrice` bug class. The
idempotent-registration idiom from Slice 0 is preserved.

**Blocked by:** 02 — Worked example: utilities + config.

**Status:** ready-for-agent (owner: Sumon, Claude reviews each model)

- [ ] Each model exports a typed document interface and a typed model
- [ ] A deliberately misspelled field (tried once, then reverted) fails the build
- [ ] Type check passes on the converted files
- [ ] All 17 backend tests still green, unmodified
