# 06 — Models + seed → TypeScript

**What to build:** All four Mongoose models (User, Product, Category, Order) typed with
document interfaces, so that reading or writing a field that doesn't exist on a model is a
build error — the permanent vaccine against the `discoutPrice` bug class. The seed script
converts in the same ticket (it requires the models, and a JavaScript file cannot require
TypeScript ones). The idempotent-registration idiom from Slice 0 is preserved.

**Blocked by:** 05 — Controllers → TypeScript.

**Status:** ready-for-agent (owner: Sumon, Claude reviews each model)

- [ ] Each model exports a typed document interface and a typed model
- [ ] A deliberately misspelled field (tried once, then reverted) fails the build
- [ ] Seed script is TypeScript and still runnable via the seed command
- [ ] Type check passes on the converted files
- [ ] All 17 backend tests still green, unmodified
