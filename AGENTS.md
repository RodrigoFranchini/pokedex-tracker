# Pokédex Tracker

A checklist for tracking Pokédex completion, starting with the 400 Paldea
entries in Pokémon Scarlet & Violet. Personal tool first, portfolio project
second.

## Status

| Part | State |
|---|---|
| **Front end** (`src/frontend`) | **Built and working**, including accounts and sync. Not deployed. |
| **Back end** (`src/backend`) | **Deployed** to Render, with Postgres on Neon. All six endpoints verified live. |

The front end still runs with **no server at all** — progress lives in
`localStorage` and the dex data ships in the bundle. An account is an addition,
not a prerequisite, and nothing is broken without one. Treat that as a test to
run, not an aspiration: sign out, block the network, and the whole app works.

Sprite images come from a CDN and are the only thing a lost connection
degrades.

## Documentation

Read the docs for whichever part you are changing before changing it. Each file
below is the single source of truth for its own scope, and they are written not
to overlap. All of them record *why* rather than just what.

| File | Authoritative for |
|---|---|
| `README.md` | Orientation: what this is, how to run it, where everything lives. |
| `docs/architecture.md` | What spans both halves: the data stores, the lifecycles, the sync contract, the auth chain, the failure behaviour. |
| `docs/decisions/` | Why the central decisions were made, and what each one costs. One record per decision. |
| `src/backend/README.md` | The server: scope, auth, schema, deployment, what is left. |
| `src/frontend/README.md` | The front end: how to run it, what is built, storage and sync, the dex data, the three seams, the design tokens. |

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

Documented in `docs/decisions/`, one record each with the reasoning and the
cost. **Do not undo one without being asked.** If you are told to, add a new
record superseding it rather than editing the old one.

Read the index first — `docs/decisions/README.md` — and then the records that
touch what you are changing. The ones most often breached by accident:

- **Same-origin API on relative paths only** (`0002`). Adding an API base URL
  breaks the auth design, not just the config.
- **One module in front of each boundary** (`0006`). A `fetch` outside
  `lib/api.ts`, or a `localStorage` call outside `storage/progress.ts`, is a
  defect even if it works.
- **The device owns the dex** (`0001`). Nothing may become a reason the app
  stops working offline or without an account.

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
- **Actuator is not under `/api`.** The health endpoint is `/actuator/health`
  and `SecurityConfig` permits exactly that path, so proxying `/api/actuator/…`
  straight through answers `401` and the warm-up ping wakes nothing. Both the
  Vite proxy and the Vercel rewrite map that one path specially.
- **Escape belongs to the browser inside a `<dialog>`.** Stopping the keydown in
  the dialog to protect the window-level shortcuts also stopped the dialog
  closing — Chromium's close-request handling listens above React's root. The
  guard goes in the window handler instead: no shortcuts while a modal is open.
- **A merge result is not a local edit.** It is written by the merge itself, so
  the hook marks it as the already-stored baseline before putting it in state.
  Otherwise the persist effect saves it straight back and pushes it to a server
  that just sent it.
- **The merge reads storage after its request returns**, so a mark made during a
  20-second cold start ends up in the union instead of being overwritten by it.
- **The account plate is positioned against the viewport, and only because
  nothing above it is positioned.** Adding `position` to `.page` in
  `App.module.css` moves it into the 900px column without any error. Its height
  and the page's top padding are both `--s5` on purpose: that is what keeps it
  off the header at every width, in place of a media query.
- **The phone's dock and the toolbar hold duplicate controls on purpose.**
  Search and the status segments exist in both `Toolbar` and `Dock`, hidden by a
  media query at 620px, and both read the same filter state. Deleting either
  copy or trying to render one conditionally reintroduces a layout jump and a
  breakpoint in JavaScript.
- **The page's bottom padding is the dock's height with search open**, not
  closed. Shrink it to the closed height and entry 400 hides behind the bar the
  moment someone opens search on an unfiltered list.
- **A text field under 16px makes iOS Safari zoom the page in on focus**, and it
  never zooms back out. `--text-field` is that 16px, it is not a step on the
  type scale, and "tidying" the dock's field or the dialog's mobile inputs back
  to `--text-sm` brings the bug straight back.
- **The dock's close slot calls `preventDefault` on `mousedown`.** Focus moving
  to the button blurs the field, the empty-field rule collapses the strip, and
  the click then arrives at a button that is the lens again — closing search
  reopened it. The blur-collapse and the toggle cannot both act on one press.
- **The dock's search focuses via `flushSync` inside the click handler.** iOS
  opens the keyboard only for a `focus()` that happened during the gesture, so
  moving that back into an effect leaves the field open with no keyboard.
- **`viewport-fit=cover` in `index.html` is what makes `env(safe-area-inset-*)`
  non-zero.** Without it the dock's face sits under the home indicator.
  `interactive-widget=resizes-content` beside it is what keeps the dock above
  the on-screen keyboard — on Chrome. iOS ignores it.
- **`position: fixed` does not mean "the bottom of the screen" on a phone.** It
  pins to the layout viewport, which the browser's own bar and the keyboard sit
  over, and iOS moves the visual viewport during a scroll without moving fixed
  elements. `Dock` tracks `visualViewport` and translates itself by the covered
  amount. Deleting that effect brings back both the drift on scroll and the bar
  hiding under the keyboard.
- **"Cursor" means two unrelated things.** `hooks/useCursor` is the keyboard
  position over the list. The `--cursor-wait-*` tokens are the mouse pointer
  while an auth request is out. Neither is the other.
- **The waiting pointer's frame is written onto the element, not held in
  state.** A cold start runs for a minute at twelve frames a second, and that is
  750 re-renders of a form to move a cursor.
- **The wording of the waking notice belongs to the front end.**
  `src/backend/README.md` quotes it and says so. Change it in
  `components/AuthDialog.tsx`, then make both READMEs agree.

## Conventions

- Comments explain *why*, not *what*. Existing comments are a good guide to the
  expected density and tone — match them.
- Doc references in code name the file only (`src/backend/README.md`), never a
  section number. Numbers drift; names do not.
- British/neutral spelling in prose is fine; code identifiers are American
  (`color` in CSS, `colour` acceptable in comments).
