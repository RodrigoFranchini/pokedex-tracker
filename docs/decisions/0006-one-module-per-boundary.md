# 0006 — One module in front of each boundary

**Status:** Accepted
**Date:** 2026-08

## Context

Every boundary the app touches — browser storage, the network, an external CDN,
the auth cookie — is a place where behaviour is subtle, failure is real, and a
mistake is hard to see from the call site. Scattered across a codebase, these
calls become impossible to reason about: "does anything else write this key?"
has no cheap answer.

## Decision

**Each boundary gets exactly one module in front of it, and nothing bypasses
it.**

| Module | Sole owner of |
|---|---|
| `src/frontend/src/storage/progress.ts` | Every `localStorage` access — progress *and* settings — and every progress push to the server |
| `src/frontend/src/lib/api.ts` | Every `fetch`. A path that starts with anything but `/api` is a bug |
| `src/frontend/src/lib/sprites.ts` | Every sprite URL. The data file holds a numeric id and no URLs |
| `src/backend/.../AuthCookieFactory.java` | Every auth cookie, so register, login and logout cannot disagree about its flags |

The layering rule that follows: **nothing above `storage/progress.ts` knows a
server exists.** `useProgress` calls `saveCaught` and `mergeWithServer`. Whether
either reached anything is not a question the UI can ask.

## Consequences

**What it buys**

- Cross-cutting concerns get stated once and hold everywhere:
  `credentials: 'include'`, the debounce, the `pagehide` flush, the schema
  version check, the cookie flags.
- **Bugs at a boundary have one place to be.** Both sync bugs in this project's
  history were found by reading a single file each. That is the entire return
  on this decision.
- Invariants can be enforced rather than hoped for. Only one module *can*
  write the storage key, so "opening the page writes nothing" is checkable.
- The seam is where instrumentation goes when something needs tracing.

**What it costs**

- Indirection. Reading a setting means going through a module rather than
  touching `localStorage` where you stand.
- The modules accumulate responsibility. `storage/progress.ts` owns storage,
  debouncing, the push queue, session state and the merge, which is a lot for
  one file — and still less confusing than that logic distributed.
- It only works if it is absolute. One `fetch` elsewhere and the guarantee is
  gone, silently. Treat a direct `fetch` or `localStorage` call outside these
  modules as a defect regardless of whether it works.
