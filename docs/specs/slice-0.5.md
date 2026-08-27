---
slice: 0.5
title: Backend TypeScript migration
status: ready-for-agent
date: 2026-08-26
decisions: [D1 learning-first, D11 TypeScript migration]
---

# Slice 0.5 — Backend TypeScript Migration

## Problem Statement

The backend is plain JavaScript. The worst bugs fixed in v2 — order items silently
dropped because a schema field had a different name, a discount price that never applied
because of a typo (`discoutPrice`) — are *type-shaped* bugs: a compiler would have caught
every one of them before the code ever ran. As the project grows through fourteen more
slices, every new model and controller written in plain JavaScript carries that same risk.
Meanwhile Sumon's frontend is already TypeScript, so the backend is also the half of the
project currently teaching him nothing about typed server code.

## Solution

Convert the backend source to TypeScript with strict checking, so that mistakes like a
misspelled field or a wrongly-shaped payload become red squiggles at build time instead of
production bugs. Production runs pre-compiled JavaScript (built once at deploy time), so
runtime behavior and performance are unchanged. The 25 existing tests — written against
public seams precisely so internals could change — prove the migration alters nothing a
user can observe.

## User Stories

1. As the developer, I want the compiler to reject a misspelled model field, so that the `discoutPrice` class of bug can never ship again.
2. As the developer, I want typed Mongoose models, so that reading or writing a field that doesn't exist on User/Product/Order/Category is a build error.
3. As the developer, I want typed Express request handlers, so that I can't send a response shape I didn't declare or forget that `req.user` may be absent.
4. As the developer, I want the two different shapes of `req.user` (full document under cookie auth, id string under Bearer auth) made explicit in types, so that the confusion documented in CLAUDE.md is visible in code instead of tribal knowledge.
5. As a learner, I want to convert files myself following one worked example, so that I learn TypeScript by doing rather than by watching.
6. As a learner, I want the build-time/runtime distinction demonstrated concretely (tsc compiles, node runs plain JS), so that I understand what TypeScript actually is and is not.
7. As a shopper on the live store, I want zero behavior change from this migration, so that browsing, ordering, and cancelling work exactly as before.
8. As the store owner deploying on Render, I want the deploy to build and boot the compiled output automatically, so that shipping stays one `git push`.
9. As the developer running the app locally, I want a dev command with instant reload for TypeScript, so that my edit-test loop stays as fast as it was with nodemon.
10. As the maintainer of the test suite, I want all 25 existing tests kept green and unmodified, so that they serve as impartial proof the migration broke nothing.
11. As a future contributor (human or agent), I want `npx tsc --noEmit` to pass on the backend like it already does on the frontend, so that both halves of the repo offer the same "is it broken?" check.
12. As the developer of later slices, I want new backend code required to be TypeScript from now on, so that the codebase converges toward one language instead of diverging.

## Implementation Decisions

- **Compile ahead of time.** Production runs compiled JavaScript from a build output
  directory; the build step is TypeScript's compiler. Render's build command gains the
  compile step and its start command points at the compiled entry. The deployment
  blueprint file is updated to match.
- **Dev uses a TypeScript watch runner** (replacing nodemon) for instant restarts; dev
  and prod deliberately differ here, optimizing for feedback speed vs. simplicity
  respectively.
- **Module system stays CommonJS-compatible** in compiled output, so the existing
  ESM-in-JS test files continue to import the app exactly as they do today.
- **Strict mode from day one** (`strict: true`). Models and controllers carry no
  `any` escape hatches; where a type is genuinely unknown at a boundary, it is named and
  narrowed rather than silenced.
- **Mongoose models get explicit document interfaces** and typed model exports; the
  idempotent-registration idiom from Slice 0 is preserved.
- **`req.user` duality is typed honestly**: cookie-auth routes see a user document type,
  Bearer-auth routes see an id string. The duality itself is *not* fixed here — that is
  Slice 1's auth refactor — but the types make it explicit and safe until then.
- **Conversion order is top-down** — server and app first, then routes, middleware,
  controllers, models (with the seed script), and leaf utilities last — with mixed JS/TS
  allowed mid-migration so the suite stays runnable after every step.
  *(Amended after a discovery on day one: the original leaf-first order is impossible in a
  CommonJS codebase, because a still-JavaScript file cannot `require` a TypeScript file —
  plain Node's resolver doesn't know `.ts` exists. A TypeScript file CAN depend on a
  JavaScript one, so conversion must flow from consumers down to dependencies.)*
- **Learning-first execution (D1):** the first file conversion is a worked example done
  together and narrated; Sumon converts the subsequent files himself with review at each
  step. Scaffolding (tsconfig, build scripts) is set up with approval and explained.
- **No logic changes.** Any bug or design itch discovered during conversion is written
  down for a later slice, not fixed inline — a migration commit must be boring.

## Testing Decisions

- A good test observes external behavior at a public seam and survives internal rewrites —
  this migration is the proof: the entire backend source changes language, and not one
  test changes with it.
- **Seam (agreed):** the existing HTTP-API seam only — the 17 backend integration tests
  from Slice 0 (auth, products, orders) run unmodified after every conversion step and
  must stay green.
- **One new check at the same seam:** after a production build, the compiled entry must
  boot and answer the health endpoint — verifying the *artifact* Render will actually run,
  not just the source the tests import.
- **Type-level acceptance:** the backend type check passes clean, mirroring the check the
  frontend already has.
- Prior art: the Slice 0 test suite and its setup (in-memory MongoDB, env isolation) is
  the pattern; nothing new is added to it this slice.

## Out of Scope

- The frontend (already TypeScript) — untouched.
- Converting the *test files* to TypeScript — they stay as-is so the safety net is never
  edited while it's being relied on; revisit later if wanted.
- The auth refactor (canonical JWT pattern, unified `req.user`) — that is Slice 1; this
  slice only *types* the current reality.
- Any behavior change, new endpoint, validation tightening, or refactor beyond what
  typing itself requires.
- CI, linting rules, or pre-commit hooks for the backend.

## Further Notes

- The migration deliberately runs file-by-file with the suite green between steps, so if a
  session ends mid-slice, the branch is always in a runnable state for handoff.
- Expected teaching moments (use `/teach` as they arise): what a `tsconfig` is, interfaces
  vs. runtime values, typing Express handlers, generics in `model<T>()`, why `strict`
  matters, build output vs. source.
