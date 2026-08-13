# Pokédex Tracker

**→ [pokedex-tracker-eight.vercel.app](https://pokedex-tracker-eight.vercel.app)**

A checklist for the 400 Paldea entries in Pokémon Scarlet & Violet. You click a
Pokémon, it turns caught, and a small number goes up. That's the whole product.

Yes, this is a to-do list. A to-do list with a React 19 front end, a Spring Boot
API, Postgres, JWT auth in an HttpOnly cookie, Flyway migrations, a merge
strategy for offline edits, and a deploy pipeline across two clouds. The
checkbox is load-bearing.

## Why this exists

Because the Pokédex in Pokémon Scarlet, the game I'm playing, is terrible. It
has no search bar, no way to filter by what you're still missing, and no mark
on version exclusives. You can spend hours hunting a Pokémon without knowing it
only exists in Violet.

So I built the screen the game did not.

The other reason is that "I built a full stack app" and "I deployed a full
stack app" are very different sentences, and only one survives contact with
reality. Building it was the easy half. The other half was:

- a free-tier back end that falls asleep and takes 20 seconds to wake up
- a cookie that must be same-origin or the whole auth design collapses
- a database in one country, an API in another, a CDN in a third

Everything past the first commit was an argument with production. The app is the
excuse; the deploy is the point. Also I genuinely wanted to finish the dex, which I did! check: // TODO: Add the Pokédex completion certificate image.

## The one idea

**The device owns your dex. The account is a backup.**

Every click is written to your own browser first, immediately. No account, no
network, no server running anywhere — the app still works. An account only adds
a copy somewhere else, so your phone and your laptop can agree on how many
Pokémon you have lied to yourself about catching.

Almost every strange-looking decision in this repo falls out of that one
sentence: silent server errors, debounced writes, and a merge that only ever
adds and never removes. See
[`docs/decisions/0001-local-first.md`](docs/decisions/0001-local-first.md).

## Status

| Part | Where it lives | Mood |
|---|---|---|
| Front end | Vercel | Awake |
| Back end | Render (free tier) | Napping, probably |
| Database | Neon | Fine, thanks |

If sign-in takes twenty seconds, that is not a bug, that is a server yawning.
The app tells you so instead of pretending.

Sign out, turn off your Wi-Fi, and keep using it. That is a test to run, not an
aspiration.

## About the AI in the room

This was built with AI assistance, and pretending otherwise would be
strange in a repo that ships an [`AGENTS.md`](AGENTS.md) at the root — 160 lines
of "here is how this codebase works, please stop guessing."

A meaningful slice of that file is the **Traps that have already bitten**
section, which is really a list of things that were confidently wrong at least
once, by human and machine alike:

- Paldean Wooper is Poison/Ground. The default variety is not the Paldean one.
  PokéAPI will happily hand you the wrong Wooper.
- Sprites are keyed by variety id, so that Wooper is `10253`, not `194`.
- PokéAPI has **no** Scarlet/Violet exclusivity data, so that list is
  hand-curated. It cannot be derived, no matter how sure anyone sounds.
- `:focus-visible` looked like the obvious way to draw the keyboard cursor.
  Browsers suppress it after a mouse click, so Enter acted on an invisible row.
- `position: fixed` does not mean "the bottom of the screen" on a phone. iOS
  taught that lesson personally.

The lesson generalises: the AI writes the code fast, and reality still gets the
final review. Every one of those bullets is a bug that shipped to a browser
before it became a line of documentation.

## Running it

The front end talks to the API on relative paths only — the dev server proxies
`/api` to the deployed back end, and Vercel rewrites the same paths in
production. You do **not** need the back end running locally to work on the UI.

From `src/frontend`:

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # typecheck + production build
npm run lint           # oxlint
npm run generate:dex   # regenerate src/data/paldea.ts from PokéAPI (by hand only)
```

From `src/backend` (needs JDK 21 and Docker running):

```bash
./mvnw spring-boot:run   # starts Postgres via compose.yaml, then the app
docker compose down -v   # wipe the database, replay migrations from V1
```

To run the front end against a **local** back end, point `API_TARGET` in
`src/frontend/vite.config.ts` at `http://localhost:8080`.

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
  .../controllers/     six endpoints, no more
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

Each half's README owns its own side. `docs/` owns only what spans both — the
contract between them, and the decisions neither half can make alone.

## Stack

React 19, TypeScript, Vite, CSS Modules. Java 21, Spring Boot, Spring Security,
JPA/Hibernate, Flyway. PostgreSQL on Neon, back end on Render via Docker, front
end on Vercel.

No component library, no state manager, no CSS framework —
[deliberately](docs/decisions/0007-no-framework-dependencies.md), and not
because it was easier. It was not easier.

## License

This repository's own code — front end and back end — is [MIT-licensed](LICENSE).

Pokémon data is not: `src/frontend/src/data/paldea.ts` is generated from
[PokéAPI](https://pokeapi.co/docs/v2), and the sprites it points at are served
from PokéAPI's own asset repository. Neither is this project's to relicense.
Pokémon and all Pokémon character names are trademarks of Nintendo, Game Freak,
and Creatures Inc. This is an unofficial fan project with no affiliation to or
endorsement from any of them, and if any of their lawyers are reading this: it's
a checkbox list, I promise.
