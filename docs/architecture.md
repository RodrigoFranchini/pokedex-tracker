# Architecture

How the two halves fit together, and the contract between them.

This document owns only what spans both sides. Anything internal to one half
belongs in that half's README: `src/frontend/README.md` and
`src/backend/README.md` are each authoritative for their own side, and this
file does not restate them.

---

## 1. The shape

```
┌─────────────────────────── browser ───────────────────────────┐
│                                                               │
│   React UI ── useProgress ──┬── storage/progress.ts ── localStorage
│              useAuth ───────┘         │                       │
│                                       │                       │
│                                  lib/api.ts     ◊              │
└───────────────────────────────────────┼───────────────────────┘
                                        │  same origin, /api/*
                                        │  cookie: token
┌───────────────────────────────────────┼───────────────────────┐
│  Spring Boot on Render                │                       │
│                                       ▼                       │
│   JwtAuthenticationFilter ── controllers ── services           │
│                                       │                       │
└───────────────────────────────────────┼───────────────────────┘
                                        │  JDBC
                                 PostgreSQL on Neon
                                 users · dex_progress
```

Three properties hold this together, and each has its own decision record:

- The browser reaches the API on **relative paths only**, so the API is always
  same-origin and the auth cookie is always first-party. A Vite proxy does this
  in development, a Vercel rewrite will do it in production. There is no base
  URL and no CORS anywhere.
  ([0002](decisions/0002-same-origin-cookie-auth.md))
- **The device is the source of truth.** The server holds a copy.
  ([0001](decisions/0001-local-first.md))
- **Each boundary has exactly one module in front of it.** All `localStorage`
  goes through `storage/progress.ts`; all `fetch` goes through `lib/api.ts`.
  ([0006](decisions/0006-one-module-per-boundary.md))

## 2. Where data lives

Three stores, three different jobs. Confusing them is how both of the sync bugs
in this project's history happened.

| Store | Holds | Cleared by | Survives |
|---|---|---|---|
| `localStorage`, key `pokedex-tracker` | The dex, plus sound and theme | Clearing site data | Logging out, closing the browser |
| Cookie `token` | Who you are, nothing else | Logging out, 7 days, clearing cookies | Reloads |
| Postgres `dex_progress` | One caught list per (user, game, dex) | Deleting the account | Everything client-side |

**Clearing cookies logs you out but keeps your dex. Clearing site data wipes the
dex.** They are independent on purpose: an account is a backup, so losing the
session must not look like losing your progress.

### The stored envelope

One JSON blob under one key. The shape is versioned and validated on read;
`src/frontend/README.md` covers the read/write rules.

```jsonc
{
  "schemaVersion": 1,
  "owner": "uuid-of-the-account-this-progress-belongs-to, or null",
  "settings": { "sound": false, "theme": "scarlet" },
  "progress": {
    "scarlet-violet": {
      "paldea": {
        "caught":    [906, 907, 909],  // national dex numbers, sparse
        "anonymous": [909],            // the subset marked with nobody signed in
        "updatedAt": "2026-08-12T…"
      }
    }
  }
}
```

`owner` and `anonymous` exist only to answer one question — *whose marks are
these?* — at the one moment it can be answered. They are the whole of
[0004](decisions/0004-progress-ownership.md); read that before touching either.

Progress is a **sparse list of national dex numbers**. Absent means not caught,
so correcting or extending the dex data never invalidates stored progress.
National, never regional: Paldea #1 and Galar #1 are different Pokémon.

## 3. The endpoints

Six, and the health check.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account, set the cookie |
| POST | `/api/auth/login` | — | Set the cookie |
| POST | `/api/auth/logout` | — | Clear the cookie |
| GET | `/api/me` | cookie | Who the cookie says you are |
| GET | `/api/progress/{game}/{dex}` | cookie | The account's caught list |
| PUT | `/api/progress/{game}/{dex}` | cookie | Replace it wholesale |
| GET | `/actuator/health` | — | Warm-up ping |

**The user is read from the cookie, never from the URL.** No endpoint takes a
user id, so there is no request that could ask for someone else's progress.

Health sits at the server root, not under `/api`. Both the dev proxy and the
production rewrite map `/api/actuator/*` onto it specially, so that `/api`
stays the app's only prefix. Getting this wrong makes the warm-up ping answer
401 and wake nothing.

## 4. Lifecycles

### Opening the page

Three things start at once, and **none of them blocks the dex from rendering**:

1. `useProgress` reads `localStorage` synchronously; the rows paint. This is the
   whole app, working, with zero network.
2. `api.wake()` pings health, starting the Render and Neon cold start *while the
   user is still browsing* rather than after they click Log in.
3. `api.me()` asks whether a valid session cookie exists.

Step 3 can stay outstanding for half a minute on a cold start, so it is routine
for someone to sign in or out before it lands. Its answer is discarded if they
have — a stale `null` would undo a good sign-in, and a stale user would undo a
sign-out.

### Marking an entry

```
click → React state → row flips immediately
                   ↓
        saveCaught(game, dex, caught)
           ↓                    ↓
      write, 300 ms        push, 2000 ms  (only when signed in)
           ↓                    ↓
      localStorage        PUT /api/progress/…
```

Two debounces, sized to what the work costs: a `localStorage` write is free, a
round trip is not. Signed out, the push half is skipped entirely on its first
line — there is no account to push to, and marking behaves identically either
way.

A `pagehide` listener flushes both, using `keepalive` so the request can outlive
the page. `sendBeacon` is not an option: it only sends POST, and this is a PUT.

### Signing in — the merge

This is the only place the two stores meet, and the only genuinely intricate
part of the system.

```
register/login → server sets cookie → setUser(account)
                                          ↓
                    useProgress re-runs with a userId
                                          ↓
                    setAccount(userId) + mergeWithServer(…)
                                          ↓
                          GET the account's list, then decide
```

The decision turns on `owner` — *whose progress is sitting on this device?*

| `owner` | Outcome | Reason |
|---|---|---|
| `null` — never signed in here | **Union.** Merge both lists, push the result | The case the design exists for: weeks of anonymous use, then an account, and none of it thrown away |
| **Your** account | **Union** | Your own device; it may hold marks made offline |
| **Another** account | **Takeover.** The server's list replaces it, keeping only what was marked with nobody signed in, then pushes | A device someone else has used must not quietly donate their dex to you — but marks made with no account open were never theirs |

A merge that adds nothing does not push. The union always contains the server's
list, so equal sizes mean the server already had everything; without that check,
merely opening the page while signed in would write to the database every time.

Two ordering rules, both load-bearing and both bugs first:

- **The merge reads local storage *after* the request returns**, so a mark made
  during a 20-second cold start lands in the union instead of being clobbered
  by it.
- **The merged set becomes the hook's "already stored" baseline** before it goes
  into state, or the persist effect saves it straight back and pushes it to the
  server that just sent it.

### Signing out

Order is the whole point:

1. **Flush** anything still inside the 2-second push window, and wait for it —
   while the cookie is still valid.
2. `POST /api/auth/logout`; the response clears the cookie.
3. Drop the local user.

Reverse 1 and 2 and the final push answers 401 and vanishes silently. Sign in on
a device holding a finished dex and sign straight back out, and step 1 is the
only thing between the account keeping it and never seeing it.

**Local progress and its `owner` are left exactly as they are.** Logging out
must not look anything like losing your dex.

## 5. Identity, end to end

```
password → bcrypt → users.password_hash
                         ↓ on login
              JWT (HS512, subject = user id, 7 days)
                         ↓
        Set-Cookie: token=…; HttpOnly; Secure; SameSite=Lax; Path=/
                         ↓ every request, credentials: 'include'
        JwtAuthenticationFilter: verify signature → load user from DB
                         ↓
        @AuthenticationPrincipal User
```

- **The token is looked up, not trusted.** The filter reads the id from the JWT
  and then loads the user from the database, so deleting a user takes effect
  immediately instead of at token expiry.
- **`httpOnly` means JavaScript cannot read the cookie, and must not try.**
  Nothing in the front end parses `document.cookie`; the only way to ask "am I
  signed in" is `GET /api/me`.
- **Sessions are stateless.** There is nothing server-side to invalidate, so
  logging out is the server telling the browser to drop the cookie. Rotating
  `JWT_SECRET` is the way to revoke every session at once.
- **CSRF protection is off, deliberately.** The defence is `SameSite=Lax` plus
  the API being same-origin with the app. That pairing is load-bearing —
  see [0002](decisions/0002-same-origin-cookie-auth.md).
- **A 401 on a request we believed was authenticated is not silent.** It means
  the session is not real, whatever the UI is showing, so the front end drops
  the user. Distinguishing that from "the network is down" is the difference
  between an app that is honest and one that lies; it took two rounds of bug
  hunting to learn.

## 6. Behaviour when things fail

The app is offline-capable, so most of these are ordinary states rather than
errors.

| Situation | What the user sees |
|---|---|
| No network | Everything works. Marks persist locally. Sprites, from a CDN, are the only visible loss |
| Server asleep | Nothing, until they try to sign in — then an explained wait, up to a minute |
| Push fails | Nothing. Every push sends the whole list, so the next change supersedes it and the next merge repairs it |
| Merge fails | Nothing. The dex is already on screen and already correct |
| Session expired or rejected | Signed out, immediately and visibly. Local progress untouched |
| `localStorage` blocked or full | The session works and cannot persist. Never a blank page |

The rule behind the first four: **the device's copy is the truth, so a failed
call to a backup is not news.** The rule behind the fifth: **a failure of
identity is news**, because everything the UI says about being signed in has
stopped being true.

## 7. The seams

Four modules are chokepoints by design. Each exists so that one concern has one
place to be wrong, which is what makes bugs in it findable.

| Module | Owns |
|---|---|
| `src/frontend/src/storage/progress.ts` | Every `localStorage` access, and every progress push to the server |
| `src/frontend/src/lib/api.ts` | Every `fetch`, the `credentials: 'include'` that makes the cookie travel, and the session-lost signal |
| `src/frontend/src/lib/sprites.ts` | Every sprite URL. The data file holds a numeric id and no URLs |
| `src/backend/.../AuthCookieFactory.java` | Every auth cookie, so login, register and logout cannot disagree about its flags |

Nothing above `storage/progress.ts` knows that a server exists. `useProgress`
calls `saveCaught` and `mergeWithServer`; whether either reached anything is not
a question the UI can ask, because it is not a question the UI should answer.

## 8. Known limits

Deliberate, understood, and cheap to live with. The reasoning is in the
decision records; this is the list.

- **Sync cannot propagate an unmark.** Merging is a union, so unmarking on one
  device while another is offline can be undone. It needs two devices, an
  offline edit and an unmark to appear at all.
  ([0003](decisions/0003-whole-list-sync.md))
- **`owner` is only set by a successful merge.** Signing in with no network
  leaves it unchanged, so marks made in that session are attributed to whoever
  the device last synced as. ([0004](decisions/0004-progress-ownership.md))
- **One game and one dex ship.** The storage shape, the URL shape and the
  primary key are all keyed by (game, dex) and ready; only `paldea` has data.
- **The front end is not deployed.** The production rewrite that makes `/api`
  same-origin is designed but not yet in place.
