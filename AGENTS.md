# Pokédex Tracker

A checklist for tracking Pokédex completion, starting with the 400 Paldea
entries in Pokémon Scarlet & Violet. Personal tool first, portfolio project
second.

## Status

| Part | State |
|---|---|
| **Front end** (`src/frontend`) | **Built and working.** Vite + React + TypeScript. |
| **Back end** (`src/backend`) | **In progress.** Spring Boot + Postgres. All six endpoints work; not deployed. |

The front end is complete and runs with **no server at all** — progress lives in
`localStorage` and the dex data ships in the bundle. The back end is an
addition, not a prerequisite. Nothing is broken without it.

The one runtime network request is for sprite images, which come from a CDN.
That is the only thing a lost connection degrades.

## Documentation

Read the README for whichever half you are changing before changing it. Each is
the single source of truth for its own side, and both record *why* rather than
just what.

| File | Authoritative for |
|---|---|
| `src/backend/README.md` | The server: scope, auth, schema, sync design, deployment, what is left. |
| `src/frontend/README.md` | The front end: how to run it, what is built, storage, the dex data, the two seams, the design tokens. |

There is no separate planning document. An earlier `prompts/` directory held
one, and it drifted out of agreement with the code — the READMEs replaced it so
that there is only one place to be wrong.

## Commands

From `src/frontend`:

```bash
npm run dev            # dev server
npm run build          # typecheck + production build
npm run lint           # oxlint
npm run generate:dex   # regenerate src/data/paldea.ts from PokeAPI (by hand only)
```

From `src/backend` (needs JDK 21 and Docker running):

```bash
./mvnw spring-boot:run   # starts Postgres via compose.yaml, then the app
docker compose down -v   # wipe the database, replay migrations from V1
```

## Decisions that are settled

Do not undo these without being asked. Each cost something to arrive at.

- **Local-first.** The app must work fully offline, with no account and no
  server. An account is an upgrade for durability, never a gate.
- **The dex data is bundled, not fetched.** A released dex never changes, so
  there is nothing to sync. `paldea.ts` is generated and committed.
- **`src/frontend/tools/generate-dex.ts` is run by hand**, never in a build or
  on a schedule.
- **`src/frontend/src/storage/progress.ts` is the only module that touches
  `localStorage`.** It is the seam that becomes an API client, and it holds the
  settings as well as the progress. Keep it that way.
- **`src/frontend/src/lib/sprites.ts` is the only place a sprite URL is built.**
  The data file stores a numeric `spriteId` and no URLs.
- **No component library, no state manager, no CSS framework.** Plain CSS with
  custom properties and CSS Modules. This is deliberate.
- **Progress is stored as a sparse list of national dex numbers**, keyed by
  game then dex. Not the regional number — those are not stable across games.
  The server stores that same list wholesale, in one `integer[]` column.
- **Persisted state is versioned and validated on read.** `schemaVersion`, a
  fallback to empty rather than a guess, and no path where a corrupt or blocked
  `localStorage` can take the page down.

## Traps that have already bitten

Documented so they are not rediscovered the hard way.

- **A species' default variety is not always the Paldean one.** Paldean Wooper
  is Poison/Ground, not Water/Ground; Paldean Tauros is Fighting, not Normal.
- **Sprites are keyed by the *variety* id, not the national number.** Paldean
  Wooper is `10253`, not `194`.
- **PokéAPI has no Scarlet/Violet availability data at all**, so
  `versionExclusive` is hand-curated inside the generator. It cannot be derived.
- **The cursor is driven by React state, never `:focus-visible`** — browsers
  suppress that pseudo-class after a mouse click, which made the selection
  invisible and Enter act on an unseen row.
- **State updaters must stay pure**, and progress is persisted in an effect.
  Saving inside the updater double-fires under StrictMode; reading `caught`
  from the closure loses marks when several land in one tick.
- **The theme is read twice** — once by `useTheme`, once by an inline script in
  `src/frontend/index.html` that runs before the app mounts so the page does not
  paint the default and then snap. Its fallback must stay in step with
  `DEFAULT_THEME` in `storage/progress.ts`.
- **Writes are debounced**, so a `pagehide` listener flushes a pending one.
  Without it, closing the tab or backgrounding on mobile loses the last toggle.
- **Storage is never re-read to build a save.** While a debounced write is
  pending, `localStorage` still holds the previous value, so a save built from
  it discards the pending change.

## Conventions

- Comments explain *why*, not *what*. Existing comments are a good guide to the
  expected density and tone — match them.
- Doc references in code name the file only (`src/backend/README.md`), never a
  section number. Numbers drift; names do not.
- British/neutral spelling in prose is fine; code identifiers are American
  (`color` in CSS, `colour` acceptable in comments).
