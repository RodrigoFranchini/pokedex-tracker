# Pokedex Tracker — Back End

The server for [Pokedex Tracker](../frontend/README.md): accounts, so that
Pokedex progress follows you between devices.

**This document is the single source of truth for the back end** — what it is
for, why it is shaped this way, how to run it, and what is left to build. If
code and this file disagree, one of them is a bug.

---

## 1. What this is, and why it is small

The front end is finished and works with **no server at all**: the dex data
ships in the bundle and progress lives in `localStorage`. The product goal is
already met without any of this.

So the back end exists for exactly one reason: **an account that carries your
progress between devices.** That is a modest job, and the scope is sized to it.

**Two tables. Six endpoints.** If it grows past that, something has gone wrong.

### The one architectural decision

**Local-first. The server is a backup and a sync target, never the source of
truth.**

The front end keeps working with no network, no account, and no server
reachable. Progress is written to `localStorage` first, exactly as it is now,
and pushed to the server when there is one to push to. Anonymous use is a
permanent, first-class path — an account is an upgrade for durability, never a
gate.

This is not a hedge. It is the only design consistent with the front end already
being finished, and it happens to solve the free-hosting problem in §8, because a
sleeping server is invisible to someone using the app.

---

## 2. Status

All six endpoints work end to end. What is left is putting it somewhere the
front end can reach.

| Piece | State |
| --- | --- |
| Skeleton, Postgres, Flyway, health | Done |
| Users: register, login, logout, `/api/me` | Done |
| Progress: `GET` and `PUT` | Done |
| Database on Neon | Done |
| Container, verified against Neon | Done |
| Deployment to Render, and the Vercel proxy | In progress |
| Front-end sync | Not started |

Build order, deliberately: users → progress → **deploy** → front end. Deploying
while there are three endpoints is much easier than deploying later with more
moving parts, so it comes before the front-end work rather than after.

---

## 3. Running it

You need **JDK 21** and **Docker Desktop running**. You do not need Postgres
installed.

```bash
./mvnw spring-boot:run
```

That is the whole setup. `spring-boot-docker-compose` reads `compose.yaml`,
starts `postgres:16`, and hands Spring the connection details, so there is no
datasource URL or password anywhere in the configuration. Flyway then applies
any pending migrations. Stopping the app stops the container but keeps its data.

| Command | What it does |
| --- | --- |
| `./mvnw spring-boot:run` | Run the app, starting Postgres with it |
| `./mvnw package` | Build the jar |
| `docker compose down -v` | Wipe the database and start clean |

Use `./mvnw`, not `mvn` — the wrapper pins the Maven version so every machine
builds identically.

Poking at the database directly:

```bash
docker exec -it backend-postgres-1 psql -U pokedex -d pokedex
```

Postgres runs in Docker rather than installed on the machine so that it matches
production, leaves nothing running when you are not working, and uninstalls with
one command instead of unpicking a Homebrew service.

### Configuration

This table is the only list of them — there is no `.env` template, because Spring
Boot does not read `.env` files and a second list would drift from this one.

Development needs none of these. `spring-boot-docker-compose` supplies the
datasource and the other two have fallbacks, so nothing secret is committed.
Production sets all five, as Render environment variables; a local container
takes them as shell exports.

| Variable | Default | Notes |
| --- | --- | --- |
| `JWT_SECRET` | a local dev string | At least 48 bytes: tokens are signed HS384, and a shorter key is rejected outright. Changing it invalidates every session at once, which is the only global revocation this design has. |
| `COOKIE_SECURE` | `false` | Must be `true` in production. Browsers will not send a `Secure` cookie over plain HTTP, so leaving it on locally means never receiving one. |
| `SPRING_DATASOURCE_URL` | from compose | Production only. `jdbc:` prefixed, unlike the string Neon hands you. |
| `SPRING_DATASOURCE_USERNAME` | from compose | Production only. |
| `SPRING_DATASOURCE_PASSWORD` | from compose | Production only. |

Two settings in `application.yaml` are load-bearing rather than preference:

- **`ddl-auto: validate`** — Flyway owns the schema, exclusively. Hibernate only
  checks that the entities match what the migrations built, and refuses to start
  if they have drifted. Anything that generates DDL from entities would put two
  systems in charge of the same tables.
- **`open-in-view: false`** — Boot defaults this on, which holds a database
  session open for the whole request so lazy loading works from a controller.
  Convenient, and a well-known way to exhaust the connection pool.

---

## 4. API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | — | Create an account, and sign in |
| `POST` | `/api/auth/login` | — | Sign in |
| `POST` | `/api/auth/logout` | — | Clear the cookie |
| `GET` | `/api/me` | cookie | The current user |
| `GET` | `/api/progress/{game}/{dex}` | cookie | The caught list |
| `PUT` | `/api/progress/{game}/{dex}` | cookie | Replaces the caught list |
| `GET` | `/actuator/health` | — | Includes the datasource, so `UP` means the database is reachable |

```bash
# register — 201, sets the cookie
curl -i -X POST localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret"}'

# login — 200, sets the cookie
curl -i -c jar.txt -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret"}'

# current user — 200 with the cookie, 401 without
curl -b jar.txt localhost:8080/api/me

# progress — the whole caught list, replaced wholesale
curl -b jar.txt -X PUT localhost:8080/api/progress/scarlet-violet/paldea \
  -H 'Content-Type: application/json' \
  -d '{"caught":[906,907,909]}'

curl -b jar.txt localhost:8080/api/progress/scarlet-violet/paldea
```

**The user is never named in a URL.** Both progress endpoints take the account
from the cookie, so there is no ownership check to write and no way to ask for
someone else's data. `/api/progress/{userId}/...` would need that check on every
request, and forgetting it once exposes everyone.

A dex nobody has saved yet answers `200` with an empty list rather than `404` —
having caught nothing is not a missing resource, and the front end should not
have to treat first use as an error. An unrecognised `(game, dex)` pair *is* a
`404`; without that check any string in the URL would create a row.

Every error, whatever produced it, comes back in the same shape:

```json
{ "message": "Invalid email or password" }
```

| Status | When |
| --- | --- |
| `400` | Validation failed — field messages joined into one sentence |
| `401` | Bad credentials, or no valid cookie on a protected endpoint |
| `404` | Unrecognised `(game, dex)` pair |
| `409` | Email already registered |

Consistency here is deliberate. Spring's default validation error is a large
nested object, and without the handler in `GlobalExceptionHandler` a client
would have to parse two different error formats depending on which layer failed.

---

## 5. Auth

**One JWT, in an httpOnly cookie.** No refresh tokens, and no token handling in
JavaScript at all.

The token holds only the user's id, an issued-at and an expiry, signed with
`JWT_SECRET`. A JWT is signed, not encrypted — anyone holding one can read the
payload — so nothing secret goes inside it. What the signature buys is that it
cannot be altered.

The cookie is `HttpOnly; SameSite=Lax; Path=/`, plus `Secure` in production, and
expires after seven days. `AuthCookieFactory` is the only place those flags are
set, because a logout that clears a cookie with different flags leaves the
original in place and the user still signed in.

On each request `JwtAuthenticationFilter` reads the cookie, verifies the
signature, loads the user, and puts it in Spring's `SecurityContext`. It never
rejects anything — a missing or invalid token is simply an anonymous request,
and whether that is allowed is `SecurityConfig`'s decision. The user is looked
up rather than trusted from the token, so a deleted account stops working
immediately instead of at expiry.

Three consequences worth being explicit about:

- **CSRF protection is disabled, and that is a real decision.** Cookie auth is
  exactly what CSRF targets — an `Authorization` header would not have this
  problem. The defence is `SameSite=Lax` on the cookie, plus the front end
  reaching the API same-origin through the Vercel rewrite (§8).
- **Logout does not invalidate the token.** It tells the browser to delete the
  cookie; the token itself stays cryptographically valid until it expires. This
  is inherent to stateless tokens. Fixing it means a revocation store, which is
  a session table by another name.
- **Sessions last a week and then end.** There is no renewal. This avoids
  refresh-token rotation entirely, at the cost of logging in again weekly.

Login answers `Invalid email or password` for both an unknown address and a
wrong password. Distinguishing them would turn the endpoint into a way to
discover which addresses have accounts.

**No password reset, and no email provider.** While the user list is one person
and a few friends, a forgotten password is one `UPDATE` statement. This removes
token hashing, expiry handling and an enumeration-safe endpoint from the design.
See §9 for what to do if that stops being true.

---

## 6. Data model

```sql
users
  id             uuid        primary key
  email          text        unique not null   -- stored lowercased
  password_hash  text        not null          -- bcrypt
  created_at     timestamptz not null
```

Four choices in those four columns:

- **`uuid`, not `bigserial`.** A sequential id leaks how many users exist and
  invites guessing at neighbours. Generated in Java rather than by the database,
  so an entity has its identity before it is saved — which is what makes `id`
  safe to use in `equals` and `hashCode`.
- **Email stored lowercased**, normalised in one place in the service so that
  registration and login cannot disagree. Postgres unique constraints are
  case-sensitive, so this is what stops `Rodrigo@x.com` becoming a second
  account. The existence check gives a clean 409; the `unique` constraint is
  what actually guarantees it, and a race between two registrations surfaces as
  a `DataIntegrityViolationException` mapped to the same status.
- **`timestamptz`, never `timestamp`.** Production runs UTC and development does
  not. Mapped to `Instant` in Java for the same reason.
- **`text`, not `varchar(n)`.** Identical in Postgres; a length limit is worth
  adding only when it is a real rule.

### `dex_progress`

```sql
dex_progress
  user_id        uuid        references users(id) on delete cascade
  game           text        not null          -- 'scarlet-violet'
  dex            text        not null          -- 'paldea'
  caught         integer[]   not null          -- national dex numbers
  updated_at     timestamptz not null
  primary key (user_id, game, dex)
```

**`caught` is the whole list in one column**, which is what makes the sync in §7
simple. It mirrors the shape the front end already stores, so syncing is a
straight translation rather than a redesign.

**Keyed by `(game, dex)` rather than assuming Paldea**, so the DLC dexes
(Kitakami, Blueberry) and other games are new rows, not a schema change. That
costs nothing today.

**National dex numbers, never regional ones.** Regional entry numbers are not
stable identity — Paldea #1 and Galar #1 are different Pokemon. Shiny tracking,
if it ever happens, is a second `integer[]` column, not a rewrite.

The list is **sorted and de-duplicated** before it is stored, so the value in the
database is canonical however the client assembled it.

Two things about the entity are unlike `User`:

- **`@EmbeddedId`, and `DexProgressId` implements `Serializable`.** The JPA spec
  requires that of composite key classes — this is the one place that interface
  is not cargo cult. It needs `equals` and `hashCode` too, since Hibernate uses
  the key object itself for identity.
- **No `@ManyToOne` to `User`.** The key holds a plain `UUID`. Mapping the
  foreign key *and* an association needs `@MapsId` and brings lazy proxies with
  it, for a navigation nothing performs.

`caught` maps to Postgres's native `integer[]` via `@JdbcTypeCode(SqlTypes.ARRAY)`
on an `int[]` field.

Recognised `(game, dex)` pairs are an allowlist in `ProgressServiceImpl`.
Adding a game is one entry there plus nothing else — the schema already keys by
game and dex.

### Migrations

Flyway, in `src/main/resources/db/migration`, named `V1__description.sql` (two
underscores). They run in order, once each, tracked in a `flyway_schema_history`
table Flyway creates itself.

**Never edit a migration that has run.** Flyway stores a checksum and will
refuse to start. Fix forward with a new file. Locally, `docker compose down -v`
wipes everything and replays from `V1`.

A schema change is always two files: the migration and the entity. `validate`
enforces that — forget one and the app will not start.

---

## 7. Sync (planned)

Progress for one dex is a list of national dex numbers. Sync is:

- **Pull on login** — fetch the server's list, union it with whatever is stored
  locally, keep the result.
- **Push on change** — send the whole list, debounced. The server stores it
  wholesale.

Last write wins, per dex, on the whole list.

**This is a deliberate simplification with one known flaw:** unmark something on
one device while offline, mark things on another, and the unmark can be undone
by the other device's push. Fixing it properly means a row per Pokemon with
timestamps and tombstones (§9).

That is not worth building now. The flaw needs two devices *and* offline edits
*and* an unmark to appear at all, and the fix is additive.

**The union-on-login is the part that matters**, because it covers the case that
will actually happen: using the app anonymously for weeks and then creating an
account. That progress must not be thrown away.

On the front end, `src/frontend/src/storage/progress.ts` is the seam this plugs
into — it is the only module that touches `localStorage`, and it was built to
become an API client. One file changes.

---

## 8. Deployment

| Piece | Host | Notes |
| --- | --- | --- |
| Front end | **Vercel** | Static build, and proxies `/api/*` to Render |
| Back end | **Render** | Free web service, built from `Dockerfile`, Ohio |
| Database | **Neon** | Free plan, Postgres 16, Ohio (`aws-us-east-2`) |

Free-tier terms move around. These were confirmed in August 2026.

**Both in Ohio, not São Paulo, despite being written in Brazil.** The browser
makes one round trip per API call; the app makes several to the database per
request. Co-locating the app and the database beats putting either one near the
user. Neon does offer `aws-sa-east-1`, but Render has no South America region,
so the app is crossing the equator regardless and the database follows it.

**The Vercel rewrite is what makes the auth design work.** With `/api/*` proxied
to Render, the browser only ever talks to one origin, so the cookie is
first-party (`SameSite=Lax` just works, including in Safari), there is **no CORS
at all**, and no custom domain is needed.

**Neon rather than Render's own Postgres.** Render's free databases are deleted
30 days after creation, plus a 14-day grace period to upgrade. For something
meant to sit at the end of a CV link for a year, a database with an expiry date
is a landmine. Neon's free plan has no expiry: 0.5 GB of storage, 100 CU-hours a
month, scales to zero after five minutes and wakes in well under a second.

One unknown, recorded rather than resolved: Neon's docs mention free projects
inactive for 90 days being subject to deletion, in a passage about deprecated
Azure regions. Whether it applies generally is unclear. The front end's warm-up
ping incidentally guards against it.

### Build

A `Dockerfile` in `src/backend`, not a platform-native Java build, because it is
what makes the host replaceable — the same image runs anywhere, so changing
platform is a URL change rather than a new pipeline.

Multi-stage: Maven 3.9.16 on JDK 21 compiles, an Alpine JRE runs. Only the jar
crosses between them. The Maven version matches the one
`.mvn/wrapper/maven-wrapper.properties` pins — bump both together or local and
production builds stop agreeing.

Tests are skipped in the image. The suite is Testcontainers-based and there is
no Docker daemon inside a Docker build.

`server.port` binds `${PORT:8080}` so the host can assign the port. That is the
only source change the whole deployment required.

Three JVM flags in the `ENTRYPOINT`, none of them preference:

- **`-XX:MaxRAMPercentage=65`** — the heap is not all a JVM uses; metaspace,
  thread stacks and the code cache sit outside it. Exceeding a container's
  memory limit is a kernel kill, not an `OutOfMemoryError`, so it presents as a
  restart loop with no stack trace.
- **`-XX:+UseSerialGC`** — G1's background threads cost memory and contend for a
  CPU there is only a fraction of.
- **`-XX:TieredStopAtLevel=1`** — C1 only. Gives up peak throughput, which this
  traffic never needs, for markedly less CPU spent compiling during startup.

Verified locally against Neon under `--memory=512m`: 263 MB resident (51% of the
limit), Flyway applying both migrations, all six endpoints, startup 21s.

### The cold start, and where it actually hurts

Render free services sleep when idle, and a JVM waking on a free container is
slow.

It is tempting to say local-first makes this invisible. For *daily use* that is
true. **But not for the path that matters to a portfolio:** someone opens the
link, looks around, and clicks *Log in* — the one action that demonstrates there
is a back end at all. That is exactly when they meet the cold start.

**The fix is a string, not a paid plan.** Say what is happening: *"Waking the
server — this can take a minute on free hosting."* An explained wait reads as
self-aware; a frozen button reads as broken. The login and register screens need
that loading state, and it is part of the plan rather than an afterthought.

Paying ~$7/month for a warm Render instance removes the problem entirely, worth
doing at the moment it has value rather than on principle. The choice is
reversible either way — the back end is a container and a database URL.

**Memory is tight** on a free instance. Set `-XX:MaxRAMPercentage` explicitly
rather than letting the JVM assume it has a whole machine.

---

## 9. Parked

Not cancelled, not planned. Each is additive — none require the design above to
be built differently.

- **Per-entry merge.** A row per `(user, game, dex, national_number)` with its
  own `updated_at`, and unmarking as a tombstone rather than a delete. Correctly
  resolves concurrent offline edits across devices, which §7 does not. Build it
  if that flaw ever actually bites.
- **Password reset.** Needs email. If it happens: store a hash of the token not
  the token, short expiry, single-use, invalidate sessions on password change,
  and return the same response whether or not the address exists.
- **Refresh tokens.** Worth it when sessions need revoking; not for a week-long
  cookie at this scale.
- **Rate limiting** on `/api/auth/*`. Registration and login are the endpoints
  that get abused first.
- **Server-side dex data.** Serving the dex from the API rather than the bundle.
  Nice architecture, buys nothing today — the bundled data is instant, free and
  works offline. Any import would run by hand when a game is added, never on a
  schedule: a released dex is frozen.
- **Trade matching.** Pairing people who each hold what the other is missing —
  the strongest argument for this app having a server at all. Needs its own
  table with opt-in visibility, not a column on `users`; contact details are
  personal data and should not exist before there is a feature using them.

---

## 10. Layout

```
src/main/java/com/rodrigofranchini/pokedextracker/
  config/         SecurityConfig            filter chain, password encoder
                  JwtAuthenticationFilter   reads the cookie, sets the principal
                  AuthCookieFactory         the only place cookie flags are set
  controllers/    AuthController            register, login, logout
                  UserController            /api/me
                  ProgressController        /api/progress/{game}/{dex}
  dtos/           RegisterRequest           validated, trims the email
                  LoginRequest
                  UserResponse              id and email only
                  ProgressRequest           the whole caught list
                  ProgressResponse
                  ErrorResponse
  entities/       User
                  DexProgress
                  DexProgressId             composite key, Serializable
  exceptions/     GlobalExceptionHandler    exception -> HTTP status
                  EmailAlreadyRegisteredException
                  InvalidCredentialsException
                  UnknownDexException
  repositories/   UserRepository
                  DexProgressRepository
  services/       UserService, JwtService, ProgressService    interfaces
    impl/         UserServiceImpl, JwtServiceImpl, ProgressServiceImpl
src/main/resources/
  application.yaml
  db/migration/   V1__create_users_table.sql
                  V2__create_dex_progress_table.sql
compose.yaml                                local Postgres
```

Package-by-layer, with an interface plus `impl` for services.

Two rules worth keeping:

**Entities never cross the HTTP boundary.** Controllers accept and return DTOs.
`UserResponse` has no password field at all, so the hash cannot leak through a
future refactor — `@JsonIgnore` on the entity is a second line of defence, not
the first. Incoming DTOs also prevent a client from setting fields it should not
own, such as `id` or `createdAt`.

**Services throw plain Java exceptions.** Nothing below `controllers/` knows
HTTP exists, which is what keeps the service layer callable from anywhere, not
only a controller. `GlobalExceptionHandler` is the single place exceptions
become status codes.

---

## 11. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | **Java 21** | LTS, and the stack already in use |
| Framework | **Spring Boot 4.1** | Web MVC, Security, Data JPA, Validation |
| Database | **PostgreSQL 16** | Real database, real constraints; Docker locally, Neon in production |
| Migrations | **Flyway** | Schema in version control from the first commit |
| Auth | **JJWT 0.12**, **bcrypt** | Slow and salted by design; never store a plaintext password |
| Health | **Actuator** | Render wants a health endpoint anyway |

**Not included:** no Redis, no queue, no message broker, no Lombok, no MapStruct.
Two tables and six endpoints do not need them.

**On Spring Boot 4:** it renamed things you will otherwise search for and not
find — `spring-boot-starter-webmvc`, not `-web`. Spring Security 7 also changed
enough that most Boot 3 answers online need adapting.

---

## 12. Not built yet

- **Deployment** to Render and Neon, with the Vercel rewrite (§8).
- **Front-end sync** — swapping `storage/progress.ts` for an API-backed version
  with the union-on-login from §7.
- **springdoc-openapi**, planned for Swagger UI. Check its Boot 4 compatibility
  before adding it.
