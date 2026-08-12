# Pokédex Tracker

A checklist for tracking Pokédex completion, starting with the 400 Paldea
entries in Pokémon Scarlet & Violet. Personal tool first, portfolio project
second.

Mark what you have caught, filter by type, version or status, and search. An
account is optional: it carries your progress to a second device and does
nothing else.

## The one idea

**The device owns your dex. The account is a backup.**

Everything you click is written to your own browser first and immediately. The
app works with no account, no network, and no server running at all. An account
only adds a copy somewhere else, so a phone and a laptop can hold the same
list.

Almost every decision in this repo follows from that sentence, including the
ones that look strange in isolation — silent server errors, debounced writes,
and a merge that only ever adds. See [`docs/decisions/0001-local-first.md`](docs/decisions/0001-local-first.md).

## Status

The front end is built and working, accounts and sync included, and is **not
deployed**. The back end is deployed to Render with Postgres on Neon, and all
six endpoints are verified live.

Sign out, block the network, and the whole app still works. That is a test to
run, not an aspiration.

## Running it

The front end talks to the API on relative paths only, so the dev server proxies
`/api` to the deployed back end. You do not need the back end running locally to
work on the front end.

From `src/frontend`:

```bash
npm install
npm run dev            # dev server on http://localhost:5173
npm run build          # typecheck + production build
npm run lint           # oxlint
npm run generate:dex   # regenerate src/data/paldea.ts from PokéAPI (by hand only)
```

From `src/backend` (needs JDK 21 and Docker running):

```bash
./mvnw spring-boot:run   # starts Postgres via compose.yaml, then the app
docker compose down -v   # wipe the database, replay migrations from V1
```

To run the front end against a **local** back end instead of the deployed one,
point `API_TARGET` in `src/frontend/vite.config.ts` at `http://localhost:8080`.

## Repository map

```
src/frontend/          React + TypeScript, built by Vite
  src/data/paldea.ts   the 400 entries, generated and committed
  src/storage/         the only module that touches localStorage
  src/lib/api.ts       the only module that calls fetch
  src/hooks/           progress, auth, filters, cursor, sound, theme
  tools/               the dex generator, run by hand

src/backend/           Java 21 + Spring Boot
  .../config/          security, JWT filter, auth cookie
  .../controllers/     six endpoints
  .../services/        auth, JWT, progress
  .../entities/        User, DexProgress
  resources/db/        Flyway migrations

docs/                  architecture and decision records
```

## Where to read next

| You want | Read |
|---|---|
| How the whole system fits together | [`docs/architecture.md`](docs/architecture.md) |
| Why something is the way it is | [`docs/decisions/`](docs/decisions/) |
| To change the front end | [`src/frontend/README.md`](src/frontend/README.md) |
| To change the back end | [`src/backend/README.md`](src/backend/README.md) |
| To work on this repo with an agent | [`AGENTS.md`](AGENTS.md) |

Each half's README is the single source of truth for its own side. `docs/` owns
only what spans both — the contract between them, and the decisions neither half
can make alone.

## Stack

React 19, TypeScript, Vite, CSS Modules. Java 21, Spring Boot, Spring Security,
JPA/Hibernate, Flyway. PostgreSQL on Neon, back end on Render via Docker. No
component library, no state manager, no CSS framework —
[deliberately](docs/decisions/0007-no-framework-dependencies.md).
