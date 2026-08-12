# Pokedex Tracker — Front End

A checklist for the 400 Paldea entries in Pokemon Scarlet & Violet. Search,
filter, mark what you have caught, and see how far along you are.

**This document is the single source of truth for the front end.** If the code
and this file disagree, one of them is a bug.

It works on its own. With no account and no server reachable, the dex ships
inside the bundle, caught state lives in `localStorage`, and every feature on
this page still works. That is a constraint the code is held to, not a
degraded fallback.

An account adds one thing: your progress follows you to another device. It is
optional, reversible, and never a gate. The server behind it is documented in
[`../backend/README.md`](../backend/README.md).

Sprite images come from a CDN and are the only thing a lost connection
degrades.

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

### The API is same-origin, always

**The front end holds no API base URL.** Every call is a relative path —
`fetch('/api/me')` — and something in front maps `/api/*` onto the server:

| Where | What does it |
| --- | --- |
| Development | `server.proxy` in `vite.config.ts` |
| Production | Vercel's rewrite |

The whole auth design rests on this. One origin means the JWT cookie is
first-party, so `SameSite=Lax` just works including in Safari, **there is no
CORS configuration anywhere**, and no custom domain is needed. A `VITE_API_URL`
would break all three at once, which is why there is not one.

Two details in the proxy that are not preference:

- **`changeOrigin: true`.** Render routes by `Host`. Without it the upstream is
  sent `localhost:5173` and never reaches the service.
- **`/api/actuator/health` is rewritten to `/actuator/health`.** Actuator sits
  at the server root and `SecurityConfig` permits exactly that path, so proxying
  it untouched answers `401` and the warm-up ping wakes nothing. Vercel needs
  the same rule, listed *before* the catch-all.

Development talks to the **deployed** server, so signing in works with nothing
else running locally. `npm run preview` does too — Vite's preview server falls
back to `server.proxy` — so it is not a way to check the no-server behaviour.
Serve `dist/` with any plain static server for that.

One caveat: the cookie is `Secure`, which Chrome and Firefox accept over
`http://localhost` and Safari historically does not.

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
| Register, log in, log out, current user | `hooks/useAuth`, `components/Account`, `components/AuthDialog` |
| Progress mirrored to that account, merged on sign-in | `storage/progress`, `hooks/useProgress` |
| Warm-up ping, and the waiting state a cold start needs | `lib/api`, `components/AuthDialog` |
| A fixed control bar on phones, holding search, status and the account | `components/Dock` |

Nothing here is behind a flag or half-wired. What is *not* built is a second
dex.

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

### On a phone

Below 620px — the same breakpoint the rows already use — **the two controls you
touch constantly move to a fixed bar at the bottom edge**, where the thumb is:
search, the caught status, and the account. Version and type stay in the
toolbar; those are set once, while status is flipped continually. The list is
400 rows long, so a filter at the top of it is a filter you have to scroll back
to.

- **Search opens on demand.** The bar holds a glyph; tapping it slides a field
  in above the bar and focuses it, and the glyph becomes the close control.
  Closing clears the query, the way Escape does everywhere else — a filter still
  applied with no field on screen to explain it is the one outcome worth
  designing out. Blurring an empty field just collapses it.
- **The status states keep their words.** `ALL / CAUGHT / MISSING` fit at 375px
  with room to spare, and a glyph for "missing" would be a guess. Only search
  and the account become glyphs, which is where the space is actually saved.
- **The glyphs are drawn here, not installed.** A lens carrying the page's own
  notch, and a notched card for the account that fills in when you are signed
  in — outline against solid is how the caught mark already says set or not set.
- **The bar's face is the panel, not lifted ground.** It is the toolbar moved to
  the thumb, so it reuses the same controls and the same proven contrast pairs.
  The plate in the corner stands alone on open ground, which is why that one is
  made of ground and this one is not.

Two things are hidden rather than rearranged: the corner plate, because the
account is in the bar and two triggers in the two least comfortable corners is
worse than one; and the keyboard legend, which names four keys a phone does not
have.

**The controls are duplicated in the DOM, not moved.** The toolbar's search and
segmented control stay mounted and are hidden by a media query, and the dock has
its own. Both copies are driven by the same filter state, so there is nothing to
keep in step, and no layout jump while JavaScript works out a breakpoint. Only
one set is ever on screen, so only one is ever in the accessibility tree.

**Text fields are 16px on a phone, and that is not a type decision.** iOS Safari
zooms the whole page in when a field smaller than that takes focus, and it does
not zoom back out — the page is left magnified and the fixed bar drifts.
`--text-field` exists for exactly this, and it applies to the dock's field and,
under 620px, to the dialog's. Everywhere the problem does not exist, the fields
keep `--text-sm`.

**The close slot suppresses its own mousedown**, and that is load-bearing.
Without it the press moves focus off the field, the empty-field rule collapses
the strip, and the click that follows lands on a button that has already turned
back into the lens — so closing search reopened it. Preventing the default on
`mousedown` keeps focus in the field long enough for the click to mean what it
says. It does not stop the click, and tapping the list still collapses an empty
field, because only this one button opts out of taking focus.

**Search focuses inside the tap, not in an effect.** `flushSync` renders the
field during the click so `focus()` still counts as coming from the gesture; iOS
opens the keyboard only for that. Focusing from an effect runs after the gesture
is over, and the field appears with no keyboard, waiting for a second tap.

**Two viewport details are load-bearing**, both in `index.html`:
`viewport-fit=cover` is what makes `env(safe-area-inset-bottom)` non-zero, and
without it the bar's face sits under the home indicator; and
`interactive-widget=resizes-content` shrinks the layout when the on-screen
keyboard opens, so the bar rides above the keyboard rather than under it.

**`fixed` alone does not put the bar on the bottom of the screen**, which is the
part that surprises. It pins to the *layout* viewport, and on a phone that is
not what you can see: Safari's bottom address bar and the keyboard sit over it,
and iOS moves the visual viewport during a scroll without moving fixed elements
with it — so the bar drifts while the page settles and hides behind the keyboard
while you type. `interactive-widget` fixes the keyboard half on Chrome and is
ignored by iOS.

So the dock measures it. `window.innerHeight - (visualViewport.height +
visualViewport.offsetTop)` is how much of the layout viewport is covered, and
the bar is translated up by exactly that on `visualViewport`'s `resize` and
`scroll`. Where the browser shrinks the layout instead, the gap is zero and the
transform is never set. This is the one piece of layout in the app done in
JavaScript, and only because there is no CSS that expresses it.

The page reserves 120px at the bottom — the bar's height *with the search field
open*, not closed. Reserving the closed height costs nothing until someone opens
search on an unfiltered list, and then entry 400 is unreachable behind the bar.

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

### The account

**One plate in the screen's top-right corner, one dialog behind it.** Signed out
the plate reads `ACCOUNT / LOG IN`; signed in the face carries your address. The
dialog is a form that switches between logging in and creating an account, or
signed in, your address and the way back out. **The dialog is mounted only while
open**, so the password never outlives it and every visit starts on the login
side.

**One dialog, two triggers.** The plate and the phone's dock both open it, so
`App` owns whether it is open and renders it; the plate is a button and nothing
more. Two dialogs, one per trigger, would put a hidden modal in the DOM at every
width.

The plate is deliberately not a header control. Sound and the world are
settings; an account is not one, and in the header row it read as a third
toggle. Two things follow from where it sits:

- **It is positioned against the viewport, not against the 900px column**, which
  works because nothing above it is positioned. Giving `.page` a `position`
  would move it. It is `absolute` rather than `fixed` on purpose: pinned, it
  would sit over the mark column of the top row on a narrow screen, and the page
  has no sticky chrome anywhere else.
- **The page's top padding is `--s5`, exactly the plate's height**, so the plate
  and the header cannot collide at any width. On a narrow screen the header
  simply wraps beneath it. That is why there is no media query for this.

**The face names the action, never the storage.** An earlier version stated
where the dex was saved — `SAVE DATA / THIS DEVICE` — which was true and read
exactly backwards: a hoverable control labelled with the current storage implies
that pressing it is how saving happens. What an account is for is said once, in
the dialog: *"An account keeps your dex on your other devices."*

Plate and dialog are the same object at two sizes: an ink title strip over a
notched face, with the face's own cut inside the frame's. That stepped corner is
what makes the window look like it came from the control that opened it.

**The cold start is answered with a sentence, not a spinner.** The free Render
instance sleeps after fifteen minutes and a JVM wakes slowly, so the warm-up
ping goes out on page load rather than on the Log in click — the wait is then
spent while someone is reading the list rather than staring at a button. If they
click before it comes back the server is provably still asleep, and the dialog
says so immediately:

> Waking the server. Up to a minute.

It says how long and stops there. Why the hosting is slow is not the waiting
person's problem, and the sentence that explained it was the longest thing in
the dialog. **This file is authoritative for that wording** —
`../backend/README.md` quotes it, and quotes this version.

Otherwise that notice waits 4s. **Login is not fast even awake** — bcrypt, on a
throttled free instance, across the Atlantic, measured between 0.8s and 2.3s —
and a threshold under that would cry "asleep" at every ordinary login. An
explained wait reads as self-aware, a frozen button reads as broken, and a wrong
explanation is worse than either.

**The mouse pointer waits too.** While a request is out, everything in the
dialog takes a drawn cursor: the page's one clipped corner, with the notch
walking the four corners a frame at a time, 80ms each — the same rhythm and the
same shape as everything else that moves here. Four `--cursor-wait-*` tokens
hold the frames, because a cursor image cannot read a custom property and
`tokens.css` stays the only file that names a colour. Three details are
load-bearing:

- **The frame is written onto the element, not held in state.** A cold start
  runs for a minute; re-rendering the form twelve times a second to move a
  cursor would be a lot of work for the same pixels.
- **Reduced motion gets frame one and no interval.** A pointer flickering at
  12fps is exactly what asking for less motion means, and one frame still says
  busy.
- **Every frame ends in `progress`.** Safari does not support SVG cursors at
  all and takes the native one.

This is the *pointer*. The cursor in `hooks/useCursor` is the keyboard position
over the list, and the two are unrelated.

A refusal the server explained is shown in its own words. Failing to reach the
server at all says so *and* says the progress is safe on this device, which is
the thing the person actually wants to know.

**The window shortcuts are off while the dialog is open.** Escape belongs to the
browser's close-request handling there. Swallowing it inside the dialog was the
first attempt and it stopped the dialog closing at all — that handling listens
above React's root, so the guard has to live in the key handler in `App.tsx`.

---

## 4. Storage and sync

Everything persisted goes through **`storage/progress.ts`, the only module in
the app that touches `localStorage` and the only one that mirrors progress to
the server**, under the single key `pokedex-tracker`:

```jsonc
{
  "schemaVersion": 1,
  "owner": null,                       // the account this progress belongs to
  "settings": { "sound": false, "theme": "scarlet" },
  "progress": {
    "scarlet-violet": {
      "paldea": {
        "caught": [906, 907, 909],
        "anonymous": [909],            // of those, marked with nobody signed in
        "updatedAt": "2026-08-07T…"
      }
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

### Sync

**The device is the source of truth. The account holds a copy.** Storage is
written first and always; the server is told afterwards, or not at all.

- **Pull on sign-in, and on every load while signed in.** That merge is the
  only way a mark made on another device arrives here. It usually unions the
  two lists and keeps the result on both sides — but not when the device holds
  *another* account's dex, which is what `owner` and `anonymous` above are for.
  The three cases and the reasoning behind them are in
  [`../../docs/decisions/0004-progress-ownership.md`](../../docs/decisions/0004-progress-ownership.md);
  read it before changing `mergeWithServer`.
- **Push on change, debounced 2s.** The whole list, never a delta — the server
  stores it in one `integer[]` column. Longer than the 300ms storage debounce
  because the costs are not comparable: a `localStorage` write is free and a
  round trip to Ohio is not. `pagehide` flushes a pending push with
  `keepalive`, because a normal fetch is cancelled on unload. `sendBeacon` is
  not an option — it only sends POST and this endpoint is a PUT.
- **Nothing is pushed while signed out.** Signing out *flushes* a pending push
  first and waits for it, while the cookie is still valid — cancelling it
  instead threw away every mark made in the two seconds before signing out,
  including the whole dex a merge had just queued for a fresh account. Local
  progress and its `owner` are then left exactly as they were: logging out must
  not look anything like losing your dex.
- **Pushes are silent, and nothing above this module can tell whether one
  worked.** Every push sends the whole list, so a failure is superseded by the
  next change and repaired by the next merge. There is nothing useful to say.
- **A merge that adds nothing does not push.** The union always contains the
  server's list, so equal sizes mean the server already had everything. Without
  that check, merely opening the page would write to the database every time.

**The union only ever adds, and that is a deliberate trade.** Unmark something
on one device while another is offline and the unmark can come back. It takes
two devices, an offline edit *and* an unmark to appear at all, and the fix — a
row per Pokemon with tombstones — is additive and parked in
[`../backend/README.md`](../backend/README.md).

Two ordering rules, both load-bearing:

- **The merge reads local storage *after* the request returns.** A mark made
  while it was in flight then lands in the union instead of being clobbered by
  it, which matters most during a 20-second cold start.
- **The merged set becomes the hook's "already stored" baseline** before it goes
  into state. Otherwise the effect that persists changes saves it straight back
  and queues a push the server does not need.

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
  storage/      progress.ts      localStorage, and the mirror to the server
  audio/        blip.ts          Web Audio, no files
  hooks/        useProgress      caught state, persisted and merged
                useAuth          the account, and the warm-up ping
                useFilters       search + status/version/type filters
                useCursor        roving tabindex, window-level keys
                useSound         sound preference and playback
                useTheme         data-theme on <html>
  components/   Header           wordmark, counter, theme and sound controls
                Account          the corner plate; hidden on a phone
                Dock             the phone's fixed bar: search, status, account
                AuthDialog       log in / create account / log out
                Meter            400 segments, seeks on click, memoised
                Toolbar          search, status, version, type chips
                DexList          the list, and the empty state
                Row              one entry; a button, memoised
                Mark             the caught marker (decorative)
                TypeBadge        one type, coloured from a token
  lib/          api.ts           the only module that calls fetch
                sprites.ts       the single place a sprite URL is built
  styles/       tokens.css       colour, space, shape, type, motion, pointer, 18 types
                global.css       reset and page-level rules
tools/
  generate-dex.ts                run by hand
index.html                       includes the pre-mount theme script
```

One CSS Module per component, alongside it.

### The three seams

**`storage/progress.ts`** is the only file that knows where progress lives —
`localStorage`, and now a server too. It became the API client it was built to
become, and nothing above it changed: the stored shape was already the shape the
server stores, a whole caught list per `(game, dex)`, which is one `integer[]`
column in `dex_progress`. See `src/backend/README.md`.

**`lib/api.ts`** is the only module that calls `fetch`. It owns
`credentials: 'include'` in one place so no call site can forget it, and it owns
the server's one error shape, so callers can tell a refusal the server explained
from the network failing to reach it. Every path in it is relative and begins
`/api` — that is the same-origin rule in §1, made checkable by grep rather than
by discipline.

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
  where the retro feel lives. The dialog snaps open in those four steps, and the
  waiting pointer runs one frame per step.
- **Things standing on open ground are made of ground.** The account plate's
  face is `--ground-lift`, the material the meter track already uses. Built out
  of `--ink` it read as a hole cut in the world rather than an object on it, and
  the cold blue-black fought the scarlet. The ink survives as the 3px frame.
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

- **Deployment.** The front end is not on Vercel yet. That needs the two
  rewrites in §1 and nothing else — there is no build configuration to add.
- **Password reset.** There is no email provider, so a forgotten password is a
  database statement. `src/backend/README.md` says what it would take.
- **Per-entry merge**, which is what would fix the unmark case in §4.
- **The DLC dexes** (Kitakami, Blueberry) and other games. `GameId` and `DexId`
  are already unions, progress is already keyed by both, and the server schema
  already keys rows by `(game, dex)` — so this is a generator run and a picker,
  not a redesign.
- **Shiny tracking.** A second list beside `caught`, in the same envelope.
- **Bundled sprites.** One function in `lib/sprites.ts`, whenever the CDN
  dependency stops being acceptable.
