# Pokedex Tracker — Front End

Phase 1 of the Pokedex Tracker: a checklist for the 400 Paldea entries in
Pokemon Scarlet & Violet.

Runs entirely in the browser. No server, no accounts, no network calls at
runtime — the dex data ships with the bundle and caught state lives in
`localStorage`.

Product context is in [`../../prompts/context.md`](../../prompts/context.md); the design and
implementation plan this was built from is in
[`../../prompts/phase1.md`](../../prompts/phase1.md).

## Running it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the built output |
| `npm run lint` | Oxlint |
| `npm run generate:dex` | Regenerate `src/data/paldea.ts` from PokeAPI |

## The dex data

`src/data/paldea.ts` is generated, committed, and imported directly. It is not
fetched at runtime, because the Paldea list was finalised at the game's release
and never changes — asking PokeAPI for it on every load would buy freshness for
data that cannot go stale, at the cost of ~800 requests per page view.

`npm run generate:dex` rebuilds it. That script is never part of the build, so
builds stay hermetic and do not depend on PokeAPI being reachable.

Two things it handles that a naive version gets wrong:

- **Regional forms.** A species' *default* variety is not always the one that
  appears in Paldea. Default Wooper is Water/Ground; Paldean Wooper is
  Poison/Ground. The script prefers a Paldean variety when one exists, and logs
  every species with multiple varieties so the rest can be reviewed.
- **Sprite identity.** Sprites are keyed by the *variety's* id, not the national
  number, so Paldean forms get their own artwork rather than their Johto
  counterpart's.
- **Version exclusives.** `versionExclusive` is the one field PokeAPI cannot
  provide: it has no Scarlet/Violet availability data at all — Lechonk, which
  exists only in these games, returns zero encounter records, and Armarouge, a
  Scarlet exclusive, carries flavour text under both versions. The list is
  hand-curated in `VERSION_EXCLUSIVES` inside the generator, so regenerating
  preserves it. The generator fails loudly if a curated national number is not
  in the dex, and prints the per-version counts (23 / 23) so an accidental
  edit shows up immediately.

## Layout

```
src/
  data/         paldea.ts        generated, committed
  storage/      progress.ts      the only module that touches localStorage
  audio/        blip.ts          Web Audio, no files
  hooks/        useProgress      caught state
                useFilters       search + filter state
                useCursor        roving tabindex, keyboard navigation
                useSound         sound preference
  components/   Header Meter Toolbar DexList Row Mark TypeBadge
  lib/          sprites.ts       the single place a sprite URL is built
  styles/       tokens.css       design tokens
                global.css       reset and page-level rules
tools/
  generate-dex.ts                run by hand
```

Two rules worth keeping:

**`storage/progress.ts` is the seam.** It is the only file that knows progress
lives in `localStorage`. When the Java back end arrives, it becomes an API
client and nothing above it changes. The stored shape is already the shape of
the eventual database — each caught national number is one row of
`(user_id, game, dex, national_number)`.

**`lib/sprites.ts` is the other seam.** No image URLs are stored in the data
file, so switching from the CDN to bundled assets is a change to one function.

## Stack

Vite, React, TypeScript. Plain CSS with custom properties, one stylesheet per
component via CSS Modules.

No component library, no icon package, no state manager, no audio library. A
checklist does not need them.
