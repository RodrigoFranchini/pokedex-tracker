# 0001 — The device owns the dex; the account is a backup

**Status:** Accepted
**Date:** 2026-08

## Context

The front end was finished and useful before any server existed. The dex data
ships in the bundle and progress lived in `localStorage`, so the product goal —
tick off 400 Pokémon and see how far you are — was already met with no back end
at all.

The reason to add a server was narrow and specific: **carry progress between a
phone and a computer.** Nothing else.

Two hosting facts shaped this. The back end runs on Render's free tier and the
database on Neon, and **both scale to zero**. A first request after idle takes
around thirty seconds. Any design where the server is on the critical path
means a checklist app that sometimes takes half a minute to show you a
checklist.

## Decision

**The device is the source of truth. The server is a backup and a sync target,
never the authority.**

Concretely:

- Progress is written to `localStorage` first and always. The server is told
  afterwards, or not at all.
- The app works fully with no account, no network, and no server reachable.
  Anonymous use is a permanent, first-class path.
- An account is an upgrade for durability. It is never a gate, and no feature
  is behind it.
- No server call is on the critical path of rendering or of marking an entry.
- Every server call is best effort and **deliberately unreported**. Nothing
  above `storage/progress.ts` can tell whether one succeeded, because nothing
  above it should have to.

## Consequences

**What it buys**

- A sleeping server is invisible. The cold start is spent on a warm-up ping
  fired while the user browses, so it costs nothing unless they sign in.
- Marking is instant, always, with no pending state, no spinner, no rollback,
  and no failure mode to model in the UI.
- Offline is not a feature that had to be built. It is the normal case.
- The back end stays small — two tables, six endpoints — because it is not
  responsible for being correct about anything the client already knows.

**What it costs**

- **Two copies exist, so they can disagree.** Reconciling them is the merge, and
  it is the most intricate code in the project. See
  [0003](0003-whole-list-sync.md) and [0004](0004-progress-ownership.md).
- **Silent failure is the default**, which is right for a flaky network and
  wrong for a rejected session. Distinguishing the two was not in the original
  design and had to be added after two rounds of bugs where the app claimed to
  be signed in while every request went out anonymous.
- Progress is only as durable as the browser profile until someone makes an
  account. Clearing site data loses it, and nothing can prevent that.

**How to test it**

Sign out, block the network, reload. The whole app works. Treat that as a test
to run, not an aspiration.
