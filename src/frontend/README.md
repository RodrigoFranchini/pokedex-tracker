# Pokedex Tracker — Front End

A checklist for the 400 Paldea entries in Pokemon Scarlet & Violet. Search,
filter, mark what you have caught, and see how far along you are.

**This document is the single source of truth for the front end.** If the code
and this file disagree, one of them is a bug.

It is finished and works on its own. There is no account, no server, and no
build step beyond Vite: the dex ships inside the bundle and caught state lives
in `localStorage`. The one runtime network request is for sprite images, which
come from a CDN and are the only thing a lost connection degrades.

The server that adds accounts is documented in
[`../backend/README.md`](../backend/README.md). It is an upgrade for
durability, never a prerequisite — nothing here breaks without it.

---

## 1. Running it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | `tsc -b` first, then the production build to `dist/` |
| `npm run preview` | Serve the built output |
| `npm run lint` | Oxlint |
| `npm run generate:dex` | Regenerate `src/data/paldea.ts` from PokeAPI, by hand only |

`build` typechecks before bundling because Vite itself strips types without
checking them — without the `tsc -b`, a type error ships.

---

## 2. What is built

| Piece | Where |
| --- | --- |
| The 400-entry list, with sprite, number, name and types | `components/DexList`, `components/Row` |
| Mark and unmark, persisted | `hooks/useProgress`, `storage/progress` |
| Search by name or regional number, accent-insensitive | `hooks/useFilters` |
| Filter by caught status, by version exclusivity, and by type | `hooks/useFilters`, `components/Toolbar` |
| Keyboard navigation over the whole list | `hooks/useCursor` |
| A 400-segment progress meter that also seeks | `components/Meter` |
| Scarlet / violet colour worlds, remembered | `hooks/useTheme`, `styles/tokens.css` |
| Synthesised blips on mark and unmark, off by default | `hooks/useSound`, `audio/blip` |

Nothing here is behind a flag or half-wired. What is *not* built is anything
involving the server: no login, no sync, no second dex.

---

## 3. The behaviour worth knowing

### Filters

- **Status** is `all` / `caught` / `missing`.
- **Version narrows to that version's exclusives only** — the shared majority
  of the dex drops out. The question it answers is "what is different about
  this game", so set it to your own game to see what you can catch, then flip
  it to build the list of what you need to trade for.
- **Types are AND, not OR.** Picking Fairy and Fighting means "both". Narrowing
  is what a filter is for; OR made a second type *widen* the results. A Pokemon
  has at most two types, so selecting three can never match — the empty state
  says so explicitly rather than leaving it a mystery.
- The eighteen type chips are collapsed by default. Shown at all times they
  outweigh the list they filter.

### The cursor

One position that is both the visible marker and the DOM focus, implemented as
a roving tabindex: only the cursor's row has `tabIndex={0}`, so Tab leaves the
list rather than stepping through 400 rows.

| Key | Does |
| --- | --- |
| `↑` `↓` | Move one row |
| `PageUp` `PageDown` | Move ten |
| `Home` `End` | First and last visible row |
| `Space` `Enter` | Mark / unmark (the row is a `<button>`; this is free) |
| `/` | Focus the search field |
| `Esc` | Clear the search, from anywhere including inside it |

The key handler lives on `window`, not on the list. The on-screen legend
promises the arrows move the cursor with no caveat about focus, so clicking
somewhere else must not silently disable them. Typing in a field is the one
exception — there the arrows belong to the caret.

Filters shrink the list under the cursor; it is clamped rather than reset, so
narrowing the view keeps your place.

### The meter

400 segments, one per entry, `role="progressbar"`. Clicking it seeks the list
to that dex number. That is a pointer-only shortcut on purpose — `Home`, `End`
and the Page keys already reach the same rows — and it is `memo`ised, because
otherwise 400 segments re-render on every single toggle.

### Sound and colour

Sound is **off until asked for**: audio that starts without consent is hostile,
and a muted default costs someone who wants it one click. Two square-wave
blips, up for mark and down-and-shorter for unmark, synthesised in
`audio/blip.ts` — no files, no library. The `AudioContext` is created on first
play rather than at import, because browsers suspend contexts made before a
user gesture.

The theme is the two games' names in the header, each button its own world, so
the label is the whole explanation. It sets `<html data-theme>` and everything
picks it up through the tokens it already uses. **A copy of that read also runs
inline in `index.html`, before the app mounts** — without it the page paints
the default and then snaps to the saved colour, which reads as a bug rather
than as a preference being restored. Its fallback must stay in step with
`DEFAULT_THEME` in `storage/progress.ts`.

---

## 4. Storage

Everything persisted goes through **`storage/progress.ts`, the only module in
the app that touches `localStorage`**, under the single key `pokedex-tracker`:

```jsonc
{
  "schemaVersion": 1,
  "settings": { "sound": false, "theme": "scarlet" },
  "progress": {
    "scarlet-violet": {
      "paldea": { "caught": [906, 907, 909], "updatedAt": "2026-08-07T…" }
    }
  }
}
```

- **Progress is a sparse list of national dex numbers**, keyed by game then
  dex. Absent means not caught, so correcting or extending the dex data never
  invalidates what is stored. National, never regional — Paldea #1 and Galar #1
  are different Pokemon.
- **The list is sorted on write**, so the stored value is canonical and diffs
  stay small.
- **Writes are debounced 300ms**, because toggling a run of entries should not
  mean a write per entry. A `pagehide` listener flushes a pending write —
  without it, closing the tab inside the window loses the last toggle, and
  `pagehide` is what fires on mobile backgrounding.
- **One in-memory envelope is the source of truth for the session.** Re-reading
  storage on every save would be wrong, not merely slow: while a debounced
  write is pending, storage still holds the previous value, so a save built
  from it would discard the pending change.
- **`schemaVersion` exists from day one.** A version that is not the current
  one falls back to empty rather than guessing, in both directions — a newer
  app's data must not be clobbered by an older one.
- **Reads never throw.** Corrupt JSON, a blocked storage API in private
  browsing, an exceeded quota: each degrades to "this session works but cannot
  persist". Losing the whole page to a parse error is not an acceptable failure
  mode for a checklist.

Two React rules fall out of this, and both were bugs first:

- **State updaters stay pure.** Persisting happens in an effect, not inside the
  updater — StrictMode invokes updaters twice in development, which double-fired
  the save and the blip.
- **Toggle uses a functional updater.** Marking quickly puts several clicks in
  one tick; reading `caught` from the closure gives them all the same stale
  value and the last one wins.

Opening the page writes nothing at all. A visitor who marks nothing must not
get today's defaults frozen into their storage, where a later change to a
default would never reach them.

---

## 5. The dex data

`src/data/paldea.ts` is generated by `tools/generate-dex.ts`, committed, and
imported directly. It is not fetched at runtime: the Paldea list was finalised
at the game's release and cannot go stale, so fetching would buy freshness for
nothing at a cost of ~800 requests per page view.

The generator is **run by hand, never in a build or on a schedule**, which
keeps builds hermetic and independent of PokeAPI being reachable.

Three things it handles that a naive version gets wrong:

- **Regional forms.** A species' *default* variety is not always the Paldean
  one — default Wooper is Water/Ground, Paldean Wooper is Poison/Ground; default
  Tauros is Normal, Paldean Tauros is Fighting. The script prefers a `-paldea`
  variety when one exists, and logs every species with multiple varieties so
  the rest can be reviewed.
- **Sprite identity.** Sprites are keyed by the *variety's* id, not the national
  number. Paldean Wooper is `10253`, not `194`, so a national-number lookup
  shows the Johto sprite.
- **Version exclusives.** `versionExclusive` is the one field PokeAPI cannot
  supply: it has no Scarlet/Violet availability data at all. Lechonk, which
  exists only in these games, returns zero encounter records; Armarouge, a
  Scarlet exclusive, carries flavour text under both versions because the *dex
  entry* exists in both. The list is hand-curated in `VERSION_EXCLUSIVES` inside
  the generator, so regenerating preserves it rather than wiping it. The
  generator fails loudly if a curated number is not in the dex, and prints the
  per-version counts (23 / 23) so an accidental edit shows up immediately.

`types.ts` documents each field of `DexEntry`, including which of them is
identity (`nationalNumber`) and which is display order (`dexNumber`).

---

## 6. Layout

```
src/
  App.tsx                        wires the hooks together; owns the global keys
  types.ts                       DexEntry, and the filter/theme unions
  data/         paldea.ts        generated, committed, never edited by hand
  storage/      progress.ts      the only module that touches localStorage
  audio/        blip.ts          Web Audio, no files
  hooks/        useProgress      caught state, persisted in an effect
                useFilters       search + status/version/type filters
                useCursor        roving tabindex, window-level keys
                useSound         sound preference and playback
                useTheme         data-theme on <html>
  components/   Header           wordmark, counter, theme and sound controls
                Meter            400 segments, seeks on click, memoised
                Toolbar          search, status, version, type chips
                DexList          the list, and the empty state
                Row              one entry; a button, memoised
                Mark             the caught marker (decorative)
                TypeBadge        one type, coloured from a token
  lib/          sprites.ts       the single place a sprite URL is built
  styles/       tokens.css       colour, space, shape, type, motion, 18 types
                global.css       reset and page-level rules
tools/
  generate-dex.ts                run by hand
index.html                       includes the pre-mount theme script
```

One CSS Module per component, alongside it.

### The two seams

**`storage/progress.ts`** is the only file that knows progress lives in
`localStorage`. When the back end is wired up it becomes an API client and
nothing above it changes. The stored shape is already the shape the server
stores — a whole caught list per `(game, dex)`, which is one `integer[]` column
in `dex_progress`. See `src/backend/README.md`.

**`lib/sprites.ts`** is the only place an image URL is built. The data file
stores a numeric `spriteId` and no URLs, so moving from the CDN to bundled
assets — for real offline use, or to drop the third-party dependency — is a
change to one function. Sprites come through jsDelivr's mirror rather than
`raw.githubusercontent.com`, which is not a CDN and is not meant to serve
production traffic.

---

## 7. Look

Plain CSS with custom properties, defined once in `styles/tokens.css`. The
constraints there are deliberate and cheap to break by accident:

- **The game's colour is the world, not an accent.** The list sits in a light
  panel on top of it, the way a GBA menu sits over the overworld. Only
  `--ground` and `--ground-lift` are themed — everything inside the panel is
  fixed, so switching worlds cannot break the contrast of anything you read.
- **A fixed `--violet`** exists separately from the themed violet ground,
  because a themed colour cannot also carry the meaning "violet exclusive".
- **An 8px space grid.** Nothing sits off it.
- **One clipped corner**, 8px at 45°, on every surface. Nothing on the page has
  a border radius. This is the whole aesthetic in one detail — it reads as game
  UI without a pixel font or a texture.
- **Mono everywhere**; the pixel face appears exactly once, as the wordmark.
- **Motion is quantised, not eased** (`80ms steps(4, end)`). The state change is
  where the retro feel lives.
- **The 18 type colours are tokens.** `TypeBadge` just points at the right one.

Fonts are self-hosted via `@fontsource`, only the weights actually used, so the
page makes no third-party font request and the type never shifts.

---

## 8. Stack

Vite, React 19, TypeScript. CSS Modules.

**No component library, no icon package, no state manager, no CSS framework, no
audio library.** A checklist does not need them, and each one would be a
larger commitment than the thing it replaces. This is a settled decision, not
an accident of scope.

---

## 9. Not built

- **Login and sync.** Waiting on the back end being deployed. It is one file:
  `storage/progress.ts` gains an API client and a union-on-login, described in
  `src/backend/README.md`.
- **The DLC dexes** (Kitakami, Blueberry) and other games. `GameId` and `DexId`
  are already unions, progress is already keyed by both, and the server schema
  already keys rows by `(game, dex)` — so this is a generator run and a picker,
  not a redesign.
- **Shiny tracking.** A second list beside `caught`, in the same envelope.
- **Bundled sprites.** One function in `lib/sprites.ts`, whenever the CDN
  dependency stops being acceptable.
