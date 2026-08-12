# 0004 — Progress carries an owner, and anonymous marks are tracked separately

**Status:** Accepted
**Date:** 2026-08

## Context

Merging is a union ([0003](0003-whole-list-sync.md)), which is right for the
case the whole design exists for: someone uses the app anonymously for weeks,
then makes an account, and none of it is thrown away.

But a union is wrong for a different case. If account A signs in on a browser,
marks a hundred entries and signs out, and account B then signs in on that same
browser, a plain union hands A's dex to B. A device someone else has used must
not quietly donate their marks to you.

So the merge needs to know **whose progress is sitting on this device** — and
the caught list alone cannot say. It is an undifferentiated list of numbers.

Two rounds of bugs came out of getting this wrong:

1. **First attempt: an `owner` tag on the envelope**, set by the merge and kept
   across sign-out, with a "different owner" branch that discarded local
   progress. Correct for the shared-browser case, and it destroyed the primary
   one: `owner` outlived the session, so marks made *after* signing out
   inherited the previous account's tag and became indistinguishable from that
   account's data. Registering on such a browser hit the discard branch, wiped
   the marks, and returned before pushing anything — so the new account got no
   row in `dex_progress` at all.
2. **Clearing `owner` on sign-out** would fix that and reopen the leak in the
   paragraph above, since the device would look anonymous the moment anyone
   signed out.

The information that is actually needed is not "who owns this device" but
**which marks are attributable to nobody** — and that is knowable only at the
moment a mark is made.

## Decision

**Keep `owner`, and record which marks were made with nobody signed in.**

- `Envelope.owner` — the account this device's progress belongs to, or `null`
  while it has only ever been anonymous. Set by a successful merge. **Survives
  sign-out**, which is what stops the next account absorbing this one's dex.
- `DexProgress.anonymous` — the subset of `caught` marked while signed out.
  Maintained in `writeCaught`: signed out, newly marked numbers are added and
  unmarked ones removed; signed in it is empty, because every mark is queued for
  the account as it is made.

The merge then has three cases:

| `owner` | Outcome |
|---|---|
| `null` | **Union**, then push if it added anything |
| The signing-in account | **Union**, then push if it added anything |
| Another account | **Takeover**: the server's list, plus this dex's `anonymous` marks. Everything else is discarded. Push if that added anything to the server's list |

Both fields are additive with a correct default, so no `schemaVersion` bump was
needed: an envelope written before them is anonymous-owned-by-nobody and holds
no separately-attributed marks, which is exactly right.

## Alternatives considered

- **Clear `owner` on sign-out.** One line, and it reopens the donation leak in
  full: sign out as A, sign in as B, and B absorbs A's dex.
- **Set `owner` to `null` when marking while signed out.** Better — it fixes the
  primary case — but still leaks: a *single* anonymous mark relabels the whole
  envelope, so A's hundred marks go to B along with it. It differs from the
  chosen design only in throwing away the precision needed to separate them.

## Consequences

**What it buys**

- Anonymous marks always reach the account you sign into, including on a
  browser that has held another account. This is the case the product exists
  for, and it was broken.
- Another account's dex is never donated, including when an anonymous mark is
  made in between the two sessions.
- The takeover branch now **pushes**, so signing in always leaves the account
  with a row that reflects the device.

**What it costs**

- A second list per dex in storage. Worst case it doubles the stored progress
  for a fully anonymous dex — a few kilobytes.
- A third piece of state that has to stay consistent. `writeCaught` is the only
  place that maintains it, and it must stay that way.
- **`owner` is only set by a *successful* merge.** Signing in with no network
  leaves it unchanged, so marks made in that session are attributed to whoever
  the device last synced as. A known gap, on a shared browser, offline.
- The takeover keeps anonymous marks for **the dex being merged only**; other
  dexes are discarded whole. The app ships one dex, so this is currently
  unreachable — worth revisiting when a second one lands.

## How to verify

The sequence that was broken, end to end:

1. Sign in, mark entries, sign out (leaves a stale `owner`).
2. Mark more entries while signed out.
3. Register a new account.

Expected: the counter never drops, a `PUT` goes out carrying the marks from
step 2, and `dex_progress` gains a row for the new account containing them.

Then the safeguard, from the same state: sign in as a *different* existing
account instead. Expected: the step-1 marks are discarded, the step-2 marks
survive and are pushed, and the first account's row is untouched.
