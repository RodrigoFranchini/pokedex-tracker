# 0003 — Sync replaces the whole list; last write wins

**Status:** Accepted
**Date:** 2026-08

## Context

With the device as the source of truth ([0001](0001-local-first.md)), two copies
of a caught list can exist and drift apart. Something has to reconcile them.

Proper reconciliation of independent edits means per-entry timestamps,
tombstones for deletions, and a conflict rule — a real distributed-systems
problem. The data being reconciled is *a list of at most 400 small integers,
edited by one person on at most a handful of devices.*

## Decision

**A dex's caught list is one value, replaced wholesale. Merging is a union.**

- **Push on change, debounced two seconds.** The entire list, never a delta.
- **Pull on sign-in, and on every load while signed in.** This is the only way a
  mark made on another device arrives.
- **The merge is a union**, so it only ever adds.
- **Storage matches.** One `integer[]` column in one row keyed by
  `(user_id, game, dex)`. Not a row per Pokémon.
- **A merge that adds nothing does not push.** The union always contains the
  server's list, so equal sizes mean the server already had everything.
- The server sorts and de-duplicates whatever arrives, so the stored value is
  canonical however the client built it.

## Alternatives considered

- **A row per caught Pokémon, with timestamps and tombstones.** Correct, and
  would propagate unmarks. Rejected as disproportionate: it triples the schema
  and the sync code to fix a flaw that needs three simultaneous conditions to
  appear. **The fix is purely additive**, so it stays available.
- **Sending deltas.** Rejected: it requires knowing what the server already has,
  which means either tracking it client-side or reading before every write. The
  whole list is at most 400 integers.

## Consequences

**What it buys**

- The merge is one line of set union, and the endpoint is one upsert.
- A failed push needs no retry logic. Every push sends everything, so the next
  change supersedes it and the next merge repairs it. That is why pushes can be
  silent at all.
- The anonymous-use case — weeks without an account, then an account — is
  handled by the union with no special casing.

**What it costs**

- **Sync cannot propagate an unmark.** Unmark something on one device while
  another is offline, and that device's next push restores it. It takes two
  devices, an offline edit *and* an unmark for this to appear at all.
- Every change pushes the whole list, so a nearly complete dex sends ~400
  integers per push. Debouncing makes that a non-issue at this size; it would
  not be at a much larger one.
- Because the union only adds, "whose marks are these?" becomes a question the
  merge cannot answer from the list alone. That is what
  [0004](0004-progress-ownership.md) exists to solve.
