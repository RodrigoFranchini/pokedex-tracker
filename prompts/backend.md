# Phase 2 — Back End

> Plan for the server. The front end it attaches to is described in
> [phase1.md](./phase1.md).
>
> **Status: not started.**
>
> **On [context.md](./context.md):** it is the opening brief, not a contract. It
> records what the product looked like before any of it was built and is
> expected to go stale. Cited here only for specific facts, never as authority.

---

## 1. Scope, and why it is small

Phase 1 is finished. It works offline, persists progress, and is pleasant to use daily. **The product goal is already met without a server.**

So the back end exists for one reason: to make this a full-stack project, with an account that carries your progress between devices. That is a modest job, and the plan is deliberately sized to it.

**Two tables. Six endpoints.** If it grows past that, something has gone wrong.

Ideas that were considered and deliberately parked are in §9 — not lost, just not the plan.

## 2. The one architectural decision

**Local-first. The server is a backup and a sync target, never the source of truth.**

The front end keeps working with no network, no account, and no server reachable. Progress is written to `localStorage` first, exactly as it is now, and pushed to the server when there is one to push to.

This is not a hedge. It is the only design consistent with the front end already being finished — and it happens to solve the free-tier problem in §7, because a sleeping server is invisible to someone using the app.

## 3. Sync: the simple version

Progress for one dex is a list of national dex numbers. Sync is:

- **Pull** on login: fetch the server's list, union it with whatever is stored locally, keep the result.
- **Push** on change: send the whole list, debounced. Server stores it wholesale.

Last write wins, per dex, on the whole list.

**This is a deliberate simplification, and it has one known flaw:** unmark something on one device while offline, mark things on another, and the unmark can be undone by the other device's push. Fixing it properly means a row per Pokémon with timestamps and tombstones (§9).

That is not worth building now. The flaw needs two devices *and* offline edits *and* an unmark to appear at all. If it ever actually happens to you, you will know, and the fix is additive. Building for it today is paying now for a problem you may never have.

The union-on-login is the part that matters, because it covers the case that *will* happen: using the app anonymously for weeks and then creating an account. That progress must not be thrown away.

## 4. Stack

| Layer | Choice | Why |
|---|---|---|
| Language | **Java 21 (LTS)** | Matches the stack you already use. |
| Framework | **Spring Boot 3.x** | Web, Security, Data JPA, Validation. |
| Auth | **JWT in an httpOnly cookie** | See §6. No token handling in JavaScript at all. |
| Passwords | **BCrypt** (Spring Security) | Never store or log a plaintext password. |
| Database | **PostgreSQL 16** | Real database, real constraints. |
| DB hosting | **Neon** | Serverless, scales to zero, free tier. |
| Migrations | **Flyway** | Schema in version control from the first commit. |
| Health | **Actuator** | Render wants a health endpoint anyway. |
| Tests | **JUnit 5 + Testcontainers** | A handful of integration tests against real Postgres. `@ServiceConnection` makes this nearly free in Spring Boot 3. |
| API docs | **springdoc-openapi** | One dependency, gives Swagger UI. Cheap, and legible to anyone reading the repo. |

**Not included:** no Redis, no queue, no refresh-token rotation, no email provider. None of them solve a problem this app has.

## 5. Data model

```sql
users
  id             uuid        primary key
  email          text        unique not null   -- stored lowercased
  password_hash  text        not null
  created_at     timestamptz not null

dex_progress
  user_id        uuid        references users(id) on delete cascade
  game           text        not null          -- 'scarlet-violet'
  dex            text        not null          -- 'paldea'
  caught         integer[]   not null          -- national dex numbers
  updated_at     timestamptz not null
  primary key (user_id, game, dex)
```

`caught` is the whole list in one column, which is what makes §3 simple. It mirrors the shape the front end already stores.

**Keyed by `(game, dex)` rather than assuming Paldea**, so the DLC dexes and other games are new rows, not a schema change. That costs nothing today.

Shiny tracking, if it ever happens, is a second `integer[]` column — not a rewrite.

## 6. Auth

**One JWT, in an httpOnly cookie.** No refresh tokens, no token handling in JavaScript, no `localStorage`.

This is possible because of a deployment trick: **Vercel proxies `/api/*` to Render**, via a rewrite in `vercel.json`. The browser therefore only ever talks to one origin, which means:

- The cookie is **first-party** — `httpOnly; Secure; SameSite=Lax` just works. No third-party-cookie problem, which would otherwise break in Safari by default.
- **No CORS at all.** Same origin, so preflights and credentials modes simply do not arise.
- No custom domain needed. Free.

The browser attaches the cookie automatically, so the front end never sees or stores a token. Logout clears the cookie.

Expiry around a week. When it lapses you log in again — acceptable at this scale, and it avoids refresh-token rotation entirely.

**No password reset, and no email.** While the user list is you and a few friends, a forgotten password is one `UPDATE` statement. This removes an email provider, token hashing, expiry handling and an enumeration-safe endpoint from the plan. §9 covers what to do if that stops being true.

### Endpoints

```
POST   /api/auth/register     email + password  → sets cookie
POST   /api/auth/login        email + password  → sets cookie
POST   /api/auth/logout                         → clears cookie
GET    /api/me                                  → current user, or 401
GET    /api/progress/{game}/{dex}               → caught list
PUT    /api/progress/{game}/{dex}               → replaces caught list
```

Six. That is the whole surface.

## 7. Deployment

| Piece | Host | Notes |
|---|---|---|
| Front end | **Vercel** | Static build, and proxies `/api/*` to Render (§6). |
| Back end | **Render** | Free web service, reached through the proxy. |
| Database | **Neon** | Free tier, autosuspends when idle, wakes quickly. |

Free-tier terms on all three move around. Confirm the current ones when signing up rather than trusting this document.

### Neon rather than Render's own Postgres

Render offers a database too, and keeping everything on one dashboard is tempting. But its *free* databases have historically been deleted after a fixed window. For something meant to sit at the end of a CV link for a year, a database with an expiry date is a landmine. Neon scales to zero and wakes in well under a second, so it is not what will make the app feel slow.

### The cold start, and where it actually hurts

**Render free services sleep when idle**, and a JVM waking on a free container is slow.

It is tempting to say local-first (§2) makes this invisible. For *daily use* that is true — the page loads from the bundle and every mark is local, so a sleeping server changes nothing.

**But it is not true for the path that matters to a portfolio.** Someone opens the link, looks around, and clicks *Log in* — the one action that demonstrates there is a back end at all. That is exactly when they meet the cold start. Local-first protects the goal that was never at risk and leaves the demo path exposed.

**The fix is a string, not a paid plan.** Say what is happening: *"Waking the server — this can take a minute on free hosting."* An explained wait reads as self-aware; a button that sits frozen for fifty seconds reads as broken. Same latency, opposite impression.

That mitigation is part of the plan, not an afterthought — the login and register screens need a loading state that is honest about why it is slow.

### If snappy ever matters more

Paying about $7 a month for a Render instance that stays warm removes the problem entirely. Worth doing *at the moment it has value* — the month someone is actually going to click the link — rather than on principle.

Everything else stays free far longer. Vercel's static tier will not be the bottleneck, and Neon's free compute is generous for one user.

**And the choice is reversible.** The back end is a container and a database URL. Moving to Fly, or to a cheap VPS, or to Oracle's always-free VM, is an afternoon rather than a rewrite. That is the argument for picking the easiest option now instead of the best one — this decision does not deserve to be agonised over.

*(Oracle's always-free tier is technically the best deal here: an always-on VM, no sleep, no cost. It is deliberately not the plan, because it means running Linux, TLS and deploys yourself. Worth learning eventually; not worth bolting onto this project.)*

**Memory is tight** on a free instance. Set `-XX:MaxRAMPercentage` explicitly rather than letting the JVM assume it has a whole machine.

### Deploy the front end now

Nothing above blocks putting Phase 1 on Vercel today. It is finished, it needs no server, and it is a portfolio piece on its own. A live link now also means the back end deployment is something you add to a working site rather than a prerequisite for having one.

## 8. Build order

1. **Skeleton** — Spring Boot, Docker Postgres, Flyway, health endpoint. Runs locally, does nothing.
2. **Users** — register, login, logout, BCrypt, JWT cookie, `GET /api/me`. The login and register screens need the honest "waking the server" loading state from §7.
3. **Progress** — `GET` and `PUT`, scoped to the logged-in user.
4. **Deploy** — Render + Neon + the Vercel rewrite. Prove it works in production while it is still small enough to debug.
5. **Front end** — swap `storage/progress.ts` for a sync-backed version, with the union-on-login from §3. One file changes, because that seam was built for this.

Steps 1–3 are a weekend or two of learning Spring. Step 4 before step 5 deliberately: deploying early, while there are three endpoints, is much easier than deploying later with more moving parts.

## 9. Parked

Not cancelled, not planned. Each is here so the reasoning is not lost, and each is additive — none require the plan above to be built differently.

**Per-entry merge.** A row per `(user, game, dex, national_number)` with its own `updated_at`, and unmarking as a tombstone rather than a delete. Correctly resolves concurrent offline edits on multiple devices, which §3 does not. Build this if the flaw in §3 ever actually bites.

**Server-side dex data.** Serving the 400 entries from the API rather than the bundle, so adding a game is a data import instead of a front-end redeploy. Genuinely nice architecture, and buys nothing today — the bundled data is instant, free, and works offline. **Import would run by hand when a new game is added, never on a schedule**: a released dex is frozen, so polling for changes to data that cannot change is busywork with a failure mode.

**Password reset.** Needs an out-of-band channel, which means email. Free routes exist that need no domain: SMTP through a Gmail app password, or a transactional provider with single-sender verification. If it happens: store a hash of the token not the token, short expiry, single-use, invalidate sessions on password change, and return the same response whether or not the address exists — otherwise it becomes a way to enumerate accounts.

**Refresh tokens.** Short-lived access token plus a rotating refresh token. Worth it when sessions need revoking; not worth it for a week-long cookie at this scale.

**Rate limiting** on `/api/auth/*`. Registration and login are the endpoints that get abused first.

**Trade matching.** People exchanging what they each need to finish the dex — the strongest argument for this app having a server at all. Arrives as a self-contained modal where you declare spares and see available trades. It does *not* need a "which game do you own" field on the user, so nothing above has to accommodate it in advance.

## 10. Local development

You have not run a server or database on this machine before, so local setup should be one command and hard to get wrong.

**Postgres in Docker, not installed on the Mac.** Docker Desktop plus a small `docker-compose.yml` running `postgres:16`. It matches production, leaves nothing running when you are not working, and uninstalls with `docker compose down -v` instead of unpicking a Homebrew install.

**Two Spring profiles**, differing only in the values of environment variables:

| Profile | Database |
|---|---|
| `local` | Docker Postgres on `localhost:5432` |
| `prod` | Neon, from environment variables |

**No connection string, JWT secret, or password is ever committed.**

**The front end points at whichever is running** through `VITE_API_URL` — `localhost` in development, the Vercel path in production. Never hardcoded.

If Docker ever misbehaves, a Neon branch gives you a disposable cloud database as an escape hatch. Docker stays the default, because it works offline and so does the app.
