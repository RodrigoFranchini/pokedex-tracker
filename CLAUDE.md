# Pokédex Tracker

A checklist for tracking Pokédex completion, starting with the 400 Paldea
entries in Pokémon Scarlet & Violet. Personal tool first, portfolio project
second.

## Status

| Part | State |
|---|---|
| **Front end** (`src/frontend`) | **Built and working.** Vite + React + TypeScript. |
| **Back end** (`src/backend`) | **Not started.** Planned in `prompts/backend.md`. |

The front end is complete and runs with **no server at all** — progress lives in
`localStorage` and the dex data ships in the bundle. The back end is an
addition, not a prerequisite. Nothing is broken without it.

## Documentation

Read these before making changes. They explain *why* things are the way they
are, and most of the surprising decisions have a reason recorded.

| File | Authoritative for |
|---|---|
| `prompts/phase1.md` | The front end: design direction, structure, behaviour. **Built — it is both plan and record.** |
| `prompts/backend.md` | The server: scope, stack, schema, deployment. **Not built — this is a plan.** |
| `prompts/context.md` | Product goals, roadmap, the PokéAPI data source and its traps. |

**On `context.md`:** it is the opening brief, written before anything was built.
It is kept current where it matters, but where it disagrees with `phase1.md` or
`backend.md`, **those win** — they describe real code and current decisions.

## Commands

All from `src/frontend`:

```bash
npm run dev            # dev server
npm run build          # typecheck + production build
npm run lint           # oxlint
npm run generate:dex   # regenerate src/data/paldea.ts from PokeAPI (by hand only)
```

## Decisions that are settled

Do not undo these without being asked. Each cost something to arrive at.

- **Local-first.** The app must work fully offline, with no account and no
  server. An account is an upgrade for durability, never a gate.
- **The dex data is bundled, not fetched.** A released dex never changes, so
  there is nothing to sync. `paldea.ts` is generated and committed.
- **`tools/generate-dex.ts` is run by hand**, never in a build or on a schedule.
- **`src/storage/progress.ts` is the only module that touches `localStorage`.**
  It is the seam that becomes an API client. Keep it that way.
- **`src/lib/sprites.ts` is the only place a sprite URL is built.** The data
  file stores a numeric `spriteId` and no URLs.
- **No component library, no state manager, no CSS framework.** Plain CSS with
  custom properties and CSS Modules. This is deliberate; see `phase1.md`.
- **Progress is stored as a sparse list of national dex numbers**, keyed by
  game then dex. Not the regional number — those are not stable across games.

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

## Conventions

- Comments explain *why*, not *what*. Existing comments are a good guide to the
  expected density and tone — match them.
- Doc references in code name the file only (`prompts/phase1.md`), never a
  section number. Numbers drift; names do not.
- British/neutral spelling in prose is fine; code identifiers are American
  (`color` in CSS, `colour` acceptable in comments).
