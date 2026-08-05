# Phase 1 — Front End

> Plan for the front-end-only build. Product context, scope, and settled decisions live in [context.md](./context.md); this document covers **how the front end looks, behaves, and is built**.
>
> Phase 1 has no server, no accounts, no network calls.
>
> **Status: built.** This is now both the plan and the record of what was
> decided. Where building something changed the plan, the reason is kept
> inline rather than edited out — those were the expensive lessons.

---

## 1. What we are building

A local React app: the 400 Paldea entries as a checklist, with caught state that survives closing the browser.

Features, from `context.md` §5.1: list, caught toggle, persistence, progress summary, search, filter by caught status and type, artwork last.

**The one job of this page:** show me what I still need to catch.

Every decision below is measured against that sentence. When something is interesting but does not serve it, it gets cut.

---

## 2. Design direction

### 2.1 The brief in one line

A retro game interface that behaves like a modern one — and that is nobody's retro game but ours.

Two words are doing work here and they mean different things.

**Retro** is the *visual and structural* language: framed panels over a coloured world, a strict grid, saturated and limited colour, hard unambiguous states, a cursor you move.

**Modern** is the *feel*, not a style. It is the quality of the flow — instant response, nothing to wait for, obvious next action, keyboard-first, comfortable on a phone. When this document says modern it never means glass, blur, gradients, or soft shadows. Those are a look. We are after the thing you notice by *using* a page, not by looking at a screenshot of it.

### 2.2 Authenticity: derive, do not copy

The instruction is that this be **completely authentic** — not a page that resembles something, a page that is its own thing.

So we take the **design logic** old game UI ran on and execute it with current craft. The logic is more interesting than the pixels anyway:

| Era mechanic | Why it existed | What we take |
|---|---|---|
| Everything on an 8px tile grid | Tile-based hardware | A strict 8px spatial system. Nothing sits off-grid. |
| Menus drew as framed windows over the world | The world stayed behind the menu | A light content panel over a saturated ground. |
| Hard states, no in-between | No alpha blending | A row is caught or it is not. No fades, no half-states. |
| Instant feedback on every input | Cartridges had no latency to hide | Zero perceptible delay. No spinners anywhere in Phase 1. |
| A single moving cursor | One selection at a time | One cursor that travels, doubling as keyboard focus. |
| Tiny fixed palette, applied by rule | Hardware colour limits | Six colours, each with one job. |
| Pixels cannot curve | Diagonals were stair-stepped | A single clipped corner as the shape signature. |

**Explicitly not doing** — the retro-pastiche default set, as templated as any AI look:

- No pixel font for body text or anything you read in quantity.
- No Game Boy green, no four-tone monochrome palette.
- No CRT scanlines, no screen curvature, no vignette, no phosphor glow.
- No Poké Balls, no Nintendo type, no in-game sprites-as-chrome, no borrowed UI furniture from any Pokémon title.
- No "PRESS START", no fake loading bars, no ironic 8-bit copy.
- No lifting Sun Haven's palette, logo treatment, or window chrome. We take devices, never values.

### 2.3 What the references gave us

Recorded so the derivation is deliberate and traceable rather than vibes.

| Reference | What it contributes | What we explicitly leave |
|---|---|---|
| **Pokémon FireRed** (GBA) menu | The core structure: a light panel with a hard double-line border, floating over a coloured world. The **▶ cursor**. Flat fills, no bevel. | Its bitmap face, its exact border pixels, its drop shadow. |
| **Pokémon Diamond** (DS) battle UI | Confirmation that the era's "modern" step meant **angled, clipped panel edges** — those HP boxes have parallelogram tails. | Its gradients, bevels, and glossy pill shapes. Those aged badly and fight our flat-fill rule. |
| **Sun Haven** brand boards | The **single clipped corner** on every swatch — the strongest shape idea in the set. Wide-tracked uppercase mono micro-labels. Saturated colour as *ground*, not accent. Pixel type used **once**, as a wordmark, never as body copy. | Their actual purple, their logo, their Windows-95 window chrome. |
| **A Short Hike** | Warmth. Retro that feels handmade and generous rather than nostalgic and cold. | Nothing to take literally; it is a tone check. |
| **anime.js** | Satisfaction comes from *responsiveness and physicality*, not from decoration. Motion earns its place by answering an input. | Its volume of animation. We have one moving part. |
| **Terminal Industries** | Dense information can stay calm. Mono at small sizes reads fine and looks intentional. | Its coldness. |
| **Undertale / Stardew Valley** | Tiny palettes and stark contrast carry further than detail. Sound is part of the interface, not a garnish. | Their literal art styles. |

### 2.4 Tokens

**Colour.** The palette inverts from the earlier draft. The game's colour stops being an accent and becomes the world; the list sits in a light panel on top of it, the way a GBA menu sits over the overworld. This solves the readability problem a saturated ground would otherwise create across 400 rows, and it comes straight out of the FireRed structure.

*Fixed everywhere:*

| Token | Hex | Role |
|---|---|---|
| `--panel` | `#EDEBF3` | The content panel. Cool and violet-tinted, deliberately not cream. |
| `--ink` | `#221B33` | Primary text on panel. Violet-black, never `#000`. |
| `--ink-soft` | `#6E6685` | Labels, metadata, caught rows at rest. |
| `--scarlet` | `#E8323F` | The mark; the Scarlet version chip. |
| `--violet` | `#6B3FBF` | The Violet version chip. |
| `--amber` | `#FFC94D` | The cursor, focus, and progress. The only warm colour, and the only one that reads on both ground and panel. |

*Themed — the only two values that move:*

| Token | Scarlet world | Violet world |
|---|---|---|
| `--ground` | `#5C1622` | `#33265C` |
| `--ground-lift` | `#822132` | `#4A3A7D` |

Type colours come from the standard 18-type convention — that vocabulary belongs to the subject, not to any one game's UI.

Scarlet and Violet are here because the games are called Scarlet and Violet. That is specific to this project in a way no chosen palette could be.

**Two consequences of making the ground themeable**, both discovered by building it:

- **Nothing inside the panel is themed.** The panel is light in both worlds, so the mark, the ink, the badges and the cursor keep identical contrast whichever world you are in. Switching changes the mood and nothing you actually read.
- **`--violet` had to become a *separate*, fixed token.** The ground's violet moves, so it cannot carry meaning. This resolves the debt flagged in the earlier draft: scarlet and violet now mean "which game" on the light panel, in either world.

One knock-on: the meter is the only element sitting directly on the ground, so its scarlet fill would have vanished into its own track in the Scarlet world. It is amber instead — which is not arbitrary, since the caught count in the header is already amber. Amber consistently means *your progress*.

**Shape.** One clipped corner, 8px at 45°, on panels, buttons, type badges, and the mark. Same corner, same size, everywhere. This is the whole aesthetic in one detail: it reads as native to game UI, it needs no pixel font and no texture, and applied consistently it makes the page unmistakably itself.

Frames use a **hard double line** — outer dark, inner light, no blur, no bevel, no radius anywhere except the notch.

**Space.** An 8px grid, non-negotiable: `8 / 16 / 24 / 32 / 48`. Row height, gutters, frame padding, and leading all land on it. It is the retro constraint and it is also just good layout discipline.

**Type.** Two faces.

| Role | Face | Why |
|---|---|---|
| Everything | **JetBrains Mono** | Your daily face, and the right one: dex numbers are catalogue numbers, mono makes columns align without effort, and at 14–15px it reads cleanly across 400 rows. Uppercase and wide-tracked for labels, normal case for names. |
| Wordmark only | **Silkscreen** | Pixel-grid heritage. Appears **once**, as "PALDEA" in the header. Nowhere else. *Departure Mono was the first choice but is not published on Fontsource; Silkscreen was the named alternate and self-hosts cleanly.* |

The restraint is the point, and it comes from your own reference: Sun Haven's logo is pixel and its body copy is not. Pixel type used once is a statement. Used throughout, it is a costume — and unreadable at list density.

JetBrains Mono carries no retro signal by itself. It does not need to. The retro reading comes from the notch, the frame, the palette, the cursor, and the timing. Type stays legible and gets out of the way.

### 2.5 Layout

Rows, not cards. The job is scanning for gaps, and rows put number, sprite, name, types, and state into fixed columns your eye runs straight down. Four hundred cards is a wall that photographs well and uses badly.

```
  ░░░░░░░░░░░░░░  --ground  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ░  PALDEA   scarlet & violet          SOUND OFF     142 / 400  ░
  ░  ████████████▏░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ░
  ░╔═════════════════════════════════════════════════════════╗   ░
  ░║ [ SEARCH      ] ALL·CAUGHT·MISSING  SCARLET VIOLET [TYPE▾]╲  ░
  ░╠═════════════════════════════════════════════════════════╣   ░
  ░║   001   (©)  Sprigatito    GRASS                    ■    ║   ░
  ░║   002   (©)  Floragato     GRASS                    ■    ║   ░
  ░║   003   (©)  Meowscarada   GRASS  DARK              ■    ║   ░
  ░║ ▶ 004   (©)  Fuecoco       FIRE                     □    ║   ░
  ░║   005   (©)  Crocalor      FIRE                     □    ║   ░
  ░╚═════════════════════════════════════════════════════════╝   ░
  ░  ↑↓ MOVE   SPACE OR ENTER MARK / UNMARK   / SEARCH          ░
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

The wordmark, the meter and the key legend sit on the ground; only the list and its toolbar are inside the panel. The panel's top-right corner carries the notch. The whole row is the target — nothing else in it is clickable, so there is no small thing to aim at and no way to miss.

**"Scarlet & violet" in the header is a control, not a label.** Each game name is the button for its own world, so the label is the whole explanation. It changes colour only — never what the list shows. That separation is deliberate: the version *filter* lives in the toolbar with the other filters, because choosing a look and choosing what you are hunting are different decisions.

### 2.6 Signature: the cursor and the snap

Two halves of one idea.

**The cursor.** A single ▶ on an amber band, sitting beside the active row and moving with the arrow keys. It is the keyboard focus indicator and the selection at the same time — one concept, not two, which is exactly how the games did it. It moves instantly between rows; it does not slide. There is always exactly one on screen, the way a game menu always has a cursor somewhere.

Three corrections this needed once it was real, all worth keeping written down:

- **The arrow is ink, not amber.** Amber on the light panel is about 1.5:1 contrast, and the focused row's *background* is already an amber band — an amber arrow would disappear precisely when it matters. The band carries the amber; the arrow stays legible.
- **It is driven by app state, never by `:focus-visible`.** Browsers deliberately suppress that pseudo-class after a mouse click, so a cursor built on it vanishes the moment you click a row — and then the arrows move an invisible selection and Enter marks something you cannot see.
- **Hover does not draw an arrow.** It did at first, which put a second arrow under the mouse while the keyboard cursor sat elsewhere: two cursors, no way to tell which one Enter would act on. Hover gets a quiet background instead — enough to show the click target, not enough to be mistaken for the selection.

**The snap.** The mark is a notched square that snaps filled. Empty is an outline; caught is solid scarlet. No fade, no scale, no easing. It changes on the frame you click it. Timing is `steps()` rather than a cubic curve — the state change is quantised, and that is where the retro feel actually lives. Around 80ms, and nothing else on the page animates on a comparable scale.

**The rule underneath both: the action is loud and the result is quiet.**

Marking is emphatic — the square snaps, the row flashes for one frame. Then the caught row settles back and **recedes**: text drops to `--ink-soft`, sprite desaturates. Missing rows stay at full contrast.

That inverts the usual collection-UI instinct to celebrate what you have. But the page's one job is *show me what I still need*, so the bright rows should be the ones with work left. You get the hit at the moment of marking and a more useful screen at rest.

Toggling twenty in a row should feel like a rhythm. That is the satisfying requirement, and — per the anime.js reading — it is an interaction-timing problem, not a decoration problem.

### 2.7 Sound

Promoted from open question to built, because three of the references (Undertale, Stardew, A Short Hike) treat sound as part of the interface rather than a garnish, and because a checklist is one of the few interfaces where a per-action blip is genuinely earned.

A short blip on mark, a lower one on unmark. Synthesised via Web Audio — no audio files, no dependency, a few dozen lines. **Off by default**, one toggle in the header, remembered in the same storage envelope.

Off by default is not timidity: audio that starts without consent is hostile, and a muted default costs a user who wants it exactly one click.

### 2.8 Calibration

Checked against both default sets and revised.

*AI-design defaults:* not cream-serif-terracotta (the panel is violet-tinted, there is no serif on the page), not near-black-with-acid (both grounds are saturated colour, not near-black, and every accent means something), not dense broadsheet (open grid, weight on the mark rather than on rules).

*Retro-pastiche defaults:* the whole of §2.2. Two earlier drafts were cut — a pale dot-matrix ground and a pixel display face used throughout — both as costume. The references then pushed the ground the other way entirely, into saturated violet, which is a better answer than either.

*Reference-copying:* the risk with references this strong is producing a Sun Haven tribute. We take the notch, the mono labels, and the saturated-ground strategy; we take none of their colour values, their logo treatment, or their window chrome. The palette derives from the games' own names, which is a source Sun Haven does not share.

---

## 3. Structure

As built, under `src/frontend/`:

```
src/
  data/          paldea.ts          generated dex data (typed, committed)
  storage/       progress.ts        the only module that touches localStorage
  audio/         blip.ts            Web Audio, no files
  lib/           sprites.ts         the single place a sprite URL is built
  hooks/         useProgress.ts     read/toggle caught state
                 useFilters.ts      search + filter state
                 useCursor.ts       the cursor + keyboard navigation
                 useSound.ts        sound preference
                 useTheme.ts        which world the page wears
  components/    Header.tsx         wordmark, theme buttons, sound, count
                 Meter.tsx          the 400-segment meter + jump-to
                 Toolbar.tsx        search, status, version and type filters
                 DexList.tsx        the list and its empty state
                 Row.tsx            one entry
                 Mark.tsx           the signature element
                 TypeBadge.tsx      one type chip
  styles/        tokens.css         the tables in §2.4, as custom properties
                 global.css         reset and page-level rules
  types.ts       shared types
  App.tsx
tools/
  generate-dex.ts                   run by hand, never at build time
```

The ▶ is rendered inside `Row` rather than as its own component — it is one span that belongs to the row's grid, and extracting it would have added a file without adding a seam.

### Data shape

```ts
type DexEntry = {
  dexNumber: number       // regional, 1–400, display and sort order
  nationalNumber: number  // identity everywhere else
  name: string            // display name, e.g. "Sprigatito"
  slug: string            // api name, e.g. "wooper-paldea"
  spriteId: number        // the *variety's* id — see below
  types: string[]         // one or two
  versionExclusive: 'both' | 'scarlet' | 'violet'
}
```

`dexNumber` is for showing and ordering. `nationalNumber` is what gets stored — per `prompts/context.md` §8, regional numbers are not stable identity across games.

Two fields were added during the build, both because the obvious shape was wrong:

- **`spriteId`.** Sprites are keyed by the *variety*, not the species: Paldean Wooper is `10253`, not its national `194`. Deriving the URL from the national number silently shows the Johto sprite.
- **`versionExclusive`.** The one field PokéAPI cannot supply at all (`prompts/context.md` §6). Curated inside the generator so regenerating preserves it, and defaulting to `'both'` so an omission fails safe.

### Storage module

The only place `localStorage` is mentioned. Everything else goes through it.

```ts
loadCaught(game, dex): Set<number>
saveCaught(game, dex, caught: Set<number>): void
loadSound(): boolean
saveSound(sound: boolean): void
loadTheme(): Theme
saveTheme(theme: Theme): void
```

Writes are debounced (~300ms) — toggling ten rows quickly should not mean ten serialisations. It reads the versioned envelope from `prompts/context.md` §8, checks `schemaVersion`, and falls back to empty progress rather than throwing if the stored value is missing or malformed. People edit and corrupt `localStorage`; losing the whole page to a parse error is not acceptable.

This module is the seam that becomes an API client in Phase 2 ([backend.md](./backend.md)). Nothing above it should know where progress lives.

**Three things the debounce made non-obvious**, each found by testing rather than by design:

- **One in-memory envelope is the source of truth for the session.** Re-reading `localStorage` on every save is not merely slow, it is wrong: while a write is pending, storage still holds the *previous* value, so a save that read it back would build from stale data and then cancel the pending write. Toggling sound and then marking a Pokémon within 300ms silently discarded the sound change.
- **A pending write is flushed on `pagehide`.** Otherwise closing the tab inside the debounce window loses the last mark — the case that actually bites on mobile.
- **Opening the page writes nothing.** Persisting on mount would freeze the current defaults into storage for someone who never interacted, so a later change to a default would silently never reach them.

### State

React state and one context. No Redux, no Zustand — this is a single screen with a set of numbers and a few filter values, and reaching for a state library here would be showing off in the wrong direction.

Toggling updates state immediately and persists after. There is no request to fail.

**Toggling must use a functional state update, and persistence must happen in an effect.** Marking a run of entries quickly puts several clicks in one tick; reading `caught` from the closure gives all of them the same pre-render value and the last one wins, silently dropping the rest. Putting the save *inside* the updater is equally wrong — updaters must be pure, and React invokes them twice in development to prove it.

---

## 4. Behaviour

**Toggle.** Click a row anywhere. Fires instantly; no confirmation. Toggling is its own undo.

**Search.** Matches name and dex number, case- and accent-insensitive. Filters as you type. Typing `4` matches #4, #40–49, #400, and Pokémon with `4` in the name — that is the honest behaviour and does not need special-casing.

**Filters.** Caught status is `all / caught / missing`, single choice, `all` by default. Type is multi-select. Version is two mutually-exclusive chips. When filters exclude everything, say so plainly and offer to clear them.

**Every filter is AND, including types among themselves.** Fairy + Fighting means "both", not "either" — one result, Iron Valiant. This started as OR, which was wrong for a simple reason: adding a second type *widened* the results, and a filter that grows as you add to it is not filtering. Since nothing has three types, selecting three is empty by definition, and the empty state says so rather than leaving it a mystery.

**The version filter is two chips, not a third segmented control.** A segmented `ALL / SCARLET / VIOLET` would have put a second "All" on the toolbar meaning something different from the first. With chips, no selection already means no filter, and clicking the active chip clears it. Selecting a version narrows to *only* that version's 23 exclusives — the question being asked is "what is different about this game", not "what can I catch".

**Filters do not change the numbering, or the total.** Dex numbers stay absolute, and the goal stays 400 — completing the Paldea dex genuinely requires trading, so the denominator must never quietly shrink to what you can catch alone.

**Keyboard.** This is where the satisfying requirement is won or lost. Arrows move the cursor, `Space`/`Enter` marks *and unmarks*, `/` jumps to search, `Escape` clears the search. You should be able to work a run of twenty entries without touching the mouse.

**The key handler is bound to the window, not to the list.** Bound to the list it only worked while the list held focus, so clicking anywhere else silently killed the arrows — while the legend promised them unconditionally. Typing in a field is the one exception; there the arrows belong to the caret.

**The legend names exactly what each key does.** `ESC CLEAR` read as "clear this Pokémon" and sent people hunting for a key that unmarks; it is `ESC CLEAR SEARCH`. And since `Space`/`Enter` is *also* how you undo a mark, it says `MARK / UNMARK`.

---

## 5. Quality floor

Built to, not announced:

- Responsive down to 375px. On narrow screens types move under the name; the mark column never collapses, because it is the point.
- On a phone the list does **not** get its own scroll region — a scroll area inside a scrolling page fights the thumb. It scrolls inside the panel only at ≥620px, where the toolbar and meter staying put is worth it.
- The cursor is the focus indicator. One concept covers both, and it is always visible.
- The theme is applied by an inline script *before* the app mounts, so a saved choice never flashes the default first.
- `prefers-reduced-motion` removes the flash. The state change stays instant and obvious, which it already was.
- Rows are real buttons with `aria-pressed`, not clickable divs.
- Colour never carries state alone — empty vs. filled is a shape difference before it is a colour difference, and a selected type chip gets an ink frame rather than just more brightness. Telling a dim chip from a bright one across eighteen colours is the comparison people are worst at.
- Contrast checked on the real pairs, especially `--ink-soft` on `--panel` for receded rows.
- Sprites lazy-load with fixed dimensions so the list never reflows as they arrive.

**Performance.** 400 rows is not a lot. We are not virtualising: it adds real complexity, breaks browser find-in-page, and solves a problem we have not measured. Filtering is a `useMemo` over an array of 400 objects. If profiling later shows a problem, revisit with numbers.

---

## 6. Stack

**Vite + React + TypeScript.** Fast, standard, boring in the right way.

**Plain CSS with custom properties, one stylesheet per component.** Not Tailwind — its defaults are a design system with opinions, and the whole point of §2 is that this page should not look like it came from someone else's defaults. The notch, the double-line frame, and the 8px grid are hand-authored primitives; that is both truer to the brief and better evidence of what you can do.

**Dependencies: as close to zero as possible.** No component library, no icon package, no state manager, no audio library. A checklist does not need them, and a showcase repo that builds a real interface from scratch says more than one assembled from parts.

---

## 7. Build order — all shipped

Each step ended somewhere usable. Kept as a record of the order, which held up.

1. **Scaffold** — Vite + React + TS. Tokens, 8px grid, notch and frame primitives, both faces self-hosted.
2. **Data** — `tools/generate-dex.ts`, run once, `paldea.ts` committed. Wooper and Tauros verified (`prompts/context.md` §6).
3. **Static list** — all 400 rows in the panel.
4. **Mark + storage** — caught state survives a reload. The product became useful here.
5. **Cursor + keyboard** — arrows, marking, the ▶.
6. **Meter** — the count and the 400-segment meter, including click-to-jump.
7. **Search and filters** — status, type, and later version.
8. **The snap** — the signature timing, the flash, the recede.
9. **Sound** — blip, toggle, remembered.
10. **Artwork** — sprites into rows, lazy-loaded.
11. **Polish** — responsive, reduced motion, empty states, contrast pass.

Added after the plan was written: the **colour theme** (§2.4) and the **version filter** (§4).

Steps 1–4 were the product. Everything after made it good.

---

## 8. Settled during the build

| Question from the original plan | Outcome |
|---|---|
| The palette inversion | **Kept**, then extended — the ground became themeable, and only two tokens move. |
| The notch as carrier of the aesthetic | **Kept.** One clipped corner on every surface; it does the work a pixel font would otherwise do. |
| All-mono | **Kept.** JetBrains Mono throughout, Silkscreen once for the wordmark. It has not read cold in practice — the sprites and the two saturated grounds carry the warmth. |
| Caught rows receding | **Kept.** The action is loud, the result is quiet, and the bright rows are the ones with work left. |
| Version-exclusive colours | **Resolved.** `--violet` became a fixed token, separate from the themed ground (§2.4). |
| Rows vs. cards, virtualisation | **Rows, no virtualisation.** 400 rows is not a lot, and virtualising breaks find-in-page. |

## 9. Still open

1. **Completion by type** — a breakdown of which types you are furthest from finishing. Answers "what should I go hunt?", uses only data already in the file, stays on the tracking side of the wiki line. Carried over, still unbuilt.

2. **A version badge on rows.** Exclusivity is only visible while the version filter is on, so browsing all 400 you cannot tell that Larvitar needs a trade. Deliberately deferred: it changes the row design rather than adding a filter.
