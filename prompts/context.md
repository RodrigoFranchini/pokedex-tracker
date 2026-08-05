# Pokédex Tracker — Product Context

> Working document. Describes **what** we are building and **why**.
> The front-end design and implementation plan lives in [phase1.md](./phase1.md);
> the server plan and its stack live in [backend.md](./backend.md).
>
> **Status:** Phase 1 is built and running. Sections 5.1 and 8 record what
> actually shipped, which is a little more than was originally scoped.

---

## 1. Summary

A personal web app to track Pokédex completion progress in Pokémon games, starting with **Pokémon Scarlet & Violet (Paldea region)**.

It is a **checklist**: every Pokémon available in the game, and a way to mark which ones have been caught. Progress toward a complete Pokédex becomes visible at a glance instead of being tracked in-game or on a spreadsheet.

The project is built in phases. **Phase 1 — the front end — is finished**: a React app with no server, storing progress in the browser. Phase 2 adds a small Java back end with accounts, planned in [backend.md](./backend.md).

## 2. Goals

**Primary (personal use)**
- Replace ad-hoc tracking (in-game menus, notes, spreadsheets) with a single, fast, filterable checklist.
- Answer at a glance: *how far am I?* and *what's still missing?*

**Secondary (portfolio)**
- Serve as a public showcase repo demonstrating full-stack ability as a student: a React front end, a Java back end, third-party API integration, persistence, and deployment.
- The code should be readable and the README approachable to a recruiter skimming for 60 seconds.

**Non-goals**
- **Not an encyclopedia.** Competitive stats, movesets, breeding, damage calculators, lore — out of scope, and not on the roadmap. If a feature makes this feel more like a wiki than a checklist, it doesn't belong.
- Not multi-user / social. Accounts exist to store *your own* progress reliably, not to share it with others. **One deliberate exception, parked for now:** trade matching — pairing people who each hold what the other is missing. Completing the Paldea dex genuinely requires trading, so this serves the checklist rather than turning the app into a social network. It is not planned work; see the "Parked" section of [backend.md](./backend.md).
- Not a live game companion (no save-file import, no game integration).

## 3. Target user

Me, first. A single player working through the Paldea Pokédex who wants a clear picture of remaining entries.

Once accounts exist the shape is unchanged: one person, one or more games, private progress.

---

## 4. Delivery phases

The phases are sequential. Each one ends at a point where the app is genuinely usable.

### Phase 1 — Front end only — **done**

A React app that runs locally. **No back end, no server, no accounts.**

- The full Paldea list (400 entries) is available to the app without a live server.
- Caught state is stored **in the browser** and survives closing and reopening it.

### Phase 2 — Back end, with accounts — **not started**

A Java service adding registration, login, and progress that follows you between devices. Accounts and the server are **one phase, not two**: a server with no accounts stores nothing worth storing, and accounts without a server are meaningless.

**[backend.md](./backend.md) is authoritative for everything about the server.** It is deliberately small — two tables, six endpoints — and several things this document once assumed are explicitly *not* in it. Notably, **the server does not ingest PokéAPI data**: the dex ships in the front-end bundle and that continues to work fine.

**The app must remain fully usable *without* an account.** Browsing and checking off Pokémon anonymously stays a first-class path; an account is an upgrade for durability and cross-device access, never a gate. Progress is written locally first and synced when there is a server to sync with.

---

## 5. Scope

### 5.1 Phase 1 features — as shipped

| # | Feature | Description |
|---|---------|-------------|
| 1 | Pokédex list | All 400 Paldea entries: regional dex number, sprite, name, types. |
| 2 | Caught toggle | Click, `Space` or `Enter` to mark caught / not caught. |
| 3 | Persistence | Caught state survives closing and reopening the browser. |
| 4 | Progress summary | `X / 400` plus a 400-segment meter that doubles as a jump-to control. |
| 5 | Search | By name or dex number, accent-insensitive. |
| 6 | Filters | Caught status (all / caught / missing), type, and **version exclusives**. |
| 7 | Artwork | Sprite per entry, lazy-loaded from a CDN. |
| 8 | Keyboard | A cursor that moves with the arrows; the list is fully workable without a mouse. |

**Added during Phase 1, beyond the original scope:**

- **Version-exclusive filter.** Was roadmap item 3; pulled forward because the data turned out to be cheap once curated. See §8.
- **Colour theme.** The page wears Scarlet or Violet, chosen from the header. Purely cosmetic and deliberately independent of the version filter — picking a look must never quietly change which Pokémon you see.
- **Sound.** A short blip on mark/unmark, off by default.

**Still out of Phase 1:**
- A per-Pokémon detail view.
- The DLC dexes.
- A version badge on rows in the unfiltered list — exclusivity is visible only while the filter is on.

**Definition of done for Phase 1:** I can use it to finish the Paldea Pokédex without touching a spreadsheet, and I'm happy enough with it to start building the back end.

### 5.2 Roadmap (after Phase 1)

Rough priority order:

1. **Back end with accounts** (Phase 2) — register/login, server-side progress, and merging existing browser-stored progress into the account on first login. See [backend.md](./backend.md); no PokéAPI ingestion on the server.
2. **Scarlet/Violet DLC dexes** — Kitakami (200 entries) and Blueberry Academy (243 entries), as separate lists alongside Paldea. Note that each will need its own curated exclusives, since the API cannot supply them (§6).
3. **Shiny tracking** — a second, independent toggle per Pokémon.
4. **Additional games** — Sword/Shield (Galar), Legends: Arceus (Hisui), Let's Go (Kanto).
5. **Extras** — export/import progress (JSON), National Dex ("living dex") mode, notes per entry, forms and regional variants.

**Done early:** version exclusives were roadmap item 3 and shipped in Phase 1 as a filter.

**Not on the roadmap:** a detail/info view with stats, moves, evolutions, or flavor text. Possible someday, but it is not a planned direction and shouldn't influence current design.

---

## 6. Data source

### PokéAPI — https://pokeapi.co

Free, public, no API key, read-only. Fair-use policy: **cache aggressively and don't hammer it.**

**Key endpoints**

| Purpose | Endpoint | Notes |
|---|---|---|
| Paldea dex | `/api/v2/pokedex/31/` | 400 entries, version group `scarlet-violet` |
| Kitakami dex | `/api/v2/pokedex/32/` | 200 entries (Teal Mask DLC) — later |
| Blueberry dex | `/api/v2/pokedex/33/` | 243 entries (Indigo Disk DLC) — later |
| Species | `/api/v2/pokemon-species/{id}/` | Localized names, evolution chain link, flavor text |
| Pokémon | `/api/v2/pokemon/{id}/` | Types, base stats, sprites, height/weight |

**Shape of a Pokédex response** (`/api/v2/pokedex/31/`):

```json
{
  "name": "paldea",
  "region": { "name": "paldea" },
  "version_groups": [{ "name": "scarlet-violet" }],
  "pokemon_entries": [
    {
      "entry_number": 1,
      "pokemon_species": {
        "name": "sprigatito",
        "url": "https://pokeapi.co/api/v2/pokemon-species/906/"
      }
    }
  ]
}
```

**The constraint that shapes Phase 1:** this endpoint returns only *dex number + species name + species URL*. Types and sprites each require a follow-up call **per Pokémon** — roughly 400 extra requests to render the list once. A front-end-only app cannot do that on every page load.

**So PokéAPI is a build-time source, not a runtime one.** The Paldea list was finalized by GameFreak at release and does not change, so fetching it repeatedly buys freshness for data that will never be stale. Instead, the dex is flattened once during development into a static data file that ships inside the app. See [Decisions](#8-decisions-made).

**Artwork.** `/pokemon/{id}` *does* return a `sprites` object with ready-made URLs, but the generator deliberately ignores it and stores only the numeric `spriteId`. The object is ~5KB per Pokémon (back, front, shiny, female, and every past generation), so keeping it would add roughly 2MB to the data file to encode what one integer already implies. URLs are built at render time by a single helper. See §8.

**Data quirks to keep in mind**
- `entry_number` is the *regional* dex number and differs from the *national* number (Sprigatito is Paldea #1, National #906). We need both — national is the key for artwork and for later cross-game features.
- Paldea includes Pokémon from earlier generations, so national numbers are non-contiguous.
- Regional and alternate forms are separate `pokemon` records under the same `pokemon-species`. We track **species**, not forms.
- **Careful when pulling types.** A species' *default* variety is not always the one that appears in Paldea. Paldean Wooper is Poison/Ground while the default (Johto) Wooper is Water/Ground; Paldean Tauros is Fighting-typed while the default is Normal. A generator that blindly reads the default variety will put wrong types on those entries. *Confirmed and handled:* the generator prefers a Paldean variety when one exists, and logs every multi-variety species for review.
- **Sprites are keyed by the variety, not the species.** Paldean Wooper's sprite id is `10253`, not its national number `194`. Using the national number silently shows the Johto sprite. The data file therefore carries a separate `spriteId`.

**Version exclusivity: the API cannot help.** This was checked directly, and the answer is not "incomplete" but "absent":

- `/pokemon/lechonk/encounters` returns **zero** areas — and Lechonk exists only in Scarlet/Violet.
- `/pokemon/larvitar/encounters` returns 24 areas, but every version listed is Crystal through Sword/Shield. There is no SV encounter data in the API at all.
- `pokemon-species` has no version-scoped availability field of any kind.
- Flavour text cannot stand in for it: **Armarouge is Scarlet-exclusive yet has English flavour text under both `scarlet` and `violet`**, because the Pokédex *entry* exists in both games even when the Pokémon does not.

So `versionExclusive` is the one field that must be hand-curated. It lives in the generator rather than in the generated file, so regenerating preserves it — see §8.

---

## 7. Technical direction

Deliberately high level — details to be decided together.

**Front end:** React (TypeScript). Should feel fast: a 400-item list, instant search/filter, immediate toggling with no perceptible lag.

**Persistence, Phase 1:** browser-local storage. Requirements: survives browser restart, no server, no account.

**Back end, Phase 2:** Java (Spring Boot). One job — own the progress state once accounts exist. **It does not ingest PokéAPI data**; the dex ships in the front-end bundle and that works. See [backend.md](./backend.md).

**Database, Phase 2:** relational (PostgreSQL).

**Deployment:** eventually publicly reachable, since it doubles as a portfolio piece. Free tiers are fine. Not a Phase 1 concern.

### Design principles

- **Phase 1 must not paint Phase 2 into a corner.** The front end should read its data and its progress state through a thin, replaceable layer, so "load from a bundled JSON file" → "load from our API" and "save to browser storage" → "save to our API" are localized changes.
- **Multi-game from the start.** Even though Phase 1 is Paldea only, the model should be `Game → Dex → Entries` rather than hardcoding Paldea. Adding Galar later should be data, not a rewrite.
- **Progress is keyed by game and dex, never by "the current game".** One browser is one user in Phase 1, so no user reference is stored locally; the server adds `user_id` around the same shape. Adding a game is a new key, not a new format.
- **Anonymous use is permanent.** No feature may require an account to browse or check off Pokémon.
- **Don't lose anonymous progress.** When accounts land, existing browser-stored progress must be importable into the new account, not discarded.
- **Species, not forms.** Track species now; leave room for forms later.
- **Own our data.** PokéAPI is an import source, not a runtime dependency.
- **Checklist, not wiki.** When in doubt about a feature, this is the tiebreaker.

---

## 8. Decisions made

| Question | Decision |
|---|---|
| Back end in the first release? | **No.** Front end only until it's satisfying as a product. |
| Auth in the first release? | **No.** But accounts are a committed roadmap item, not a maybe. |
| Where does progress live initially? | **Browser storage**, must survive restart. Server-side later. |
| Can the app be used without an account? | **Always yes**, at every phase. |
| Version exclusives in the first list? | **Yes**, as a filter — pulled forward from the roadmap. Hand-curated, 23 Scarlet / 23 Violet. |
| Where does the curated exclusives list live? | **Inside the generator**, not in the generated file, so regenerating preserves it. |
| Colour theme vs. version filter | **Separate controls.** Theme is cosmetic; the filter changes data. Choosing a look must not change what you see. |
| Default theme on first visit | **Scarlet.** A saved choice always wins. |
| Sound | Present, **off by default** — audio that starts without consent is hostile. |
| Artwork in the first list? | Yes, but **last** — after the checklist mechanics work. |
| Detail/info view? | **Dropped.** Not in scope, not on the roadmap. |
| How does the dex data reach the app? | **Bundled static data file**, generated once from PokéAPI during development and committed to the repo. No runtime fetch. |
| Data as a file, or written into the component? | **Its own file, one per dex** — separate from presentation, so other games are added as data. |
| Browser storage mechanism | **`localStorage`**, single namespaced key, versioned envelope. |
| What identifies a Pokémon in stored progress | **National dex number**, never the regional entry number. |
| Artwork delivery | **Hotlinked from a CDN**, URL derived from the national number at render time. Not bundled, not stored in the data file. |
| Generator script | **Committed to the repo**, outside the app source, run manually. Never part of the build. |

### On bundling the dex data

The Paldea list is fixed: 400 entries, finalized at the game's release, never updated. There is nothing to keep in sync, so the app should not ask PokéAPI for it at runtime.

The data is generated once by a development script that hits PokéAPI, flattens each entry (regional number, national number, name, types), and writes the result to a file committed to the repo. The app imports that file directly — no network, no loading state, works offline, instant.

**This is hardcoding, deliberately.** The only real choice is whether the 400 entries live *inside* the list component or in their own file. They live in their own file, because:

- The list component becomes a loop over data it receives, rather than 400 lines of literal markup.
- Adding a game later means adding a data file, not writing a second component.
- Regenerating the data (a fix, a new field) touches one file and never touches UI code.

At runtime both approaches are identical — the file is compiled into the bundle either way. The separation costs nothing and is what makes the multi-game roadmap cheap.

Given a TypeScript front end, prefer a typed module exporting the array over a raw `.json` file: the shape gets checked at compile time and there is no parse step. Same static, bundled result.

### On stored progress

**Mechanism: `localStorage`.** It survives browser restart, which `sessionStorage` does not. The whole payload is a few hundred numbers — a few KB — so IndexedDB's complexity buys nothing. Cookies are wrong here: the data would be sent on every request once a back end exists.

**Identity: the national dex number.** Regional entry numbers are not stable identity — Paldea #1 and Galar #1 are different Pokémon. A species is the same species in every game, so national number is the only key that stays correct as games are added, and it is the key the artwork URL is derived from too.

**Shape: a versioned envelope, with caught Pokémon stored as a sparse list of IDs per dex.**

```json
{
  "schemaVersion": 1,
  "settings": { "sound": false, "theme": "scarlet" },
  "progress": {
    "scarlet-violet": {
      "paldea": {
        "caught": [906, 907, 909],
        "updatedAt": "2026-08-03T14:02:11.000Z"
      }
    }
  }
}
```

`settings` was added after the fact **without a `schemaVersion` bump**, because it is purely additive: stored data missing the key falls back to defaults, and an unrecognised value falls back too. A bump is for changes that would make old data *wrong*, not for new optional fields.

Why this shape:

- **`schemaVersion`** makes future migrations a read-and-upgrade instead of a guess. Anything long-lived in user storage needs it from day one.
- **Nested by game, then dex.** Progress is per-dex — the three Scarlet/Violet dexes are separate registers in-game, and the same species can appear in more than one. Adding Galar is a new key, not a new format.
- **A sparse list of caught IDs, not a map of all 400 to `true`/`false`.** Absent means not caught. Storage stays proportional to actual progress, and correcting or extending the dex data never requires touching stored progress.
- **Extends to shiny tracking** without restructuring: a sibling `"shiny": [...]` list alongside `"caught"`.
- **It maps cleanly onto the server.** The planned table is one row per `(user_id, game, dex)` holding the whole `caught` list as an array — the same shape with a user attached, so syncing is a straight translation rather than a redesign. (A row *per Pokémon* would resolve concurrent offline edits more precisely; that is deliberately parked — see [backend.md](./backend.md).)

Access goes through one small module, never `localStorage` calls scattered through components. That module is the seam that gets swapped for the API client in Phase 2.

### On artwork

Sprite URLs on the `PokeAPI/sprites` repository are predictable from the national dex number, so the data file stores **no image URLs at all** — a single helper derives the URL from the number at render time.

Serve them through a CDN mirror (jsDelivr fronts the GitHub repo) rather than hitting GitHub raw directly: raw is not a CDN and is not meant to serve production traffic.

Bundling all 400 images is rejected for Phase 1 — official artwork would add hundreds of megabytes to the repo to solve a problem we don't have. Images lazy-load as the list scrolls. Because every URL comes from one helper, switching to bundled assets later (for offline use, or to drop the third-party dependency) is a change in one function.

Prefer the compact sprites for the list itself; higher-resolution artwork only where something is displayed large.

### On the generator script

**Committed to the repo**, along with its generated output.

It lives outside the application source — a top-level `tools/` (or `scripts/`) directory — and is run manually, by hand, when the data needs regenerating. It is **never** wired into the build or the dev server: builds stay hermetic, fast, and independent of PokéAPI being reachable.

Committing it is right on the merits, not just for show. It documents where the data came from, makes the file reproducible instead of a mystery blob, and turns a data fix into "edit the script, re-run it" rather than hand-patching hundreds of entries. That it also demonstrates a real ETL step in a portfolio repo is a bonus, not the reason.

### On version exclusives

The API cannot supply this (§6), so the list is hand-curated: **23 Scarlet, 23 Violet**, reviewed against a trusted source rather than taken on trust from a first draft — the first draft had six of them backwards and was missing a whole line.

It lives as `VERSION_EXCLUSIVES` inside `tools/generate-dex.ts`, which emits a `versionExclusive` field onto every row. The alternative — typing the values straight into `paldea.ts` — would have been silently destroyed the next time anyone ran the generator, and that file's own header says *do not edit by hand*.

Two guards, because curated data has no compiler behind it:

- The generator **throws** if a curated national number is not in the dex, so a typo is loud instead of a value that quietly matches nothing.
- It **prints the per-version counts** on every run, so an accidental edit shows up immediately.

**Scope:** standard wild version-exclusivity in the base game. Tera Raid and mass-outbreak availability is deliberately ignored — the question being answered is "can I find this in my copy", not "has this ever been obtainable". Anything uncurated defaults to `both`, which fails safe: a species missed here reads as normally catchable rather than falsely telling you to go and trade for it.

## 9. Open questions

1. **Version badge on rows.** Exclusivity is currently visible only while the version filter is on, so browsing all 400 you cannot tell that Larvitar needs a trade. Deferred deliberately — it changes the row design rather than adding a filter.
2. **The DLC dexes will each need their own curated exclusives**, with no help from the API.

---

## 10. Reference numbers

| Dex | Entries |
|---|---|
| Paldea (base game) | 400 |
| Kitakami (Teal Mask) | 200 |
| Blueberry (Indigo Disk) | 243 |
