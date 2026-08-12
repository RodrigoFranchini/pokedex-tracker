/**
 * The only module in the app that touches localStorage, and now the only one
 * that mirrors progress to the server.
 *
 * The device is the source of truth. Storage is written first and always, an
 * account only adds a copy elsewhere, and every server call in here is best
 * effort: nothing above this module can tell whether one succeeded, because
 * nothing above it should have to.
 */

import * as api from '../lib/api'
import type { DexId, GameId, Theme } from '../types'

const STORAGE_KEY = 'pokedex-tracker'

/**
 * Bump when the stored shape changes, and add a migration in `migrate`.
 * Anything long-lived in user storage needs this from day one.
 */
const SCHEMA_VERSION = 1

/** Toggling a run of entries should not mean a write per entry. */
const WRITE_DEBOUNCE_MS = 300

/**
 * Longer than the storage debounce, because the costs are not comparable: a
 * localStorage write is free and a round trip to Ohio is not. Working through a
 * run of entries should send one request, not one per pause for breath.
 */
const PUSH_DEBOUNCE_MS = 2000

type DexProgress = {
  /**
   * National dex numbers, sparse. Absent means not caught, so correcting or
   * extending the dex data never invalidates stored progress. The planned
   * server table holds this same list per (user, game, dex).
   */
  caught: number[]
  updatedAt: string
  /**
   * The subset of `caught` marked while nobody was signed in.
   *
   * The envelope's owner outlives the session that set it — it has to, or a
   * device holding one account's dex would donate it to the next one signed in
   * here. The cost is that a mark made after signing out inherits that tag and
   * becomes indistinguishable from the previous account's own data, which is
   * exactly what made signing in throw it away. This is the distinction, kept
   * at the moment the mark is made, which is the only moment it is known.
   */
  anonymous: number[]
}

type Settings = {
  sound: boolean
  theme: Theme
}

type Envelope = {
  schemaVersion: number
  /**
   * The account this device's progress belongs to, or null while it has only
   * ever been anonymous. This is the whole difference between a union and a
   * takeover on sign-in, and it is why signing out must not clear it.
   */
  owner: string | null
  settings: Settings
  progress: Record<string, Record<string, DexProgress>>
}

/** Scarlet is the world a first-time visitor lands in. */
const DEFAULT_THEME: Theme = 'scarlet'

const EMPTY: Envelope = {
  schemaVersion: SCHEMA_VERSION,
  owner: null,
  settings: { sound: false, theme: DEFAULT_THEME },
  progress: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads and validates the envelope, falling back to empty progress rather than
 * throwing. People edit and corrupt localStorage; losing the whole page to a
 * parse error is not an acceptable failure mode for a checklist.
 */
function read(): Envelope {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private browsing and blocked-storage modes throw on access. The app stays
    // usable for the session; it just cannot persist.
    return structuredClone(EMPTY)
  }

  if (!raw) return structuredClone(EMPTY)

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return structuredClone(EMPTY)
    return migrate(parsed)
  } catch {
    return structuredClone(EMPTY)
  }
}

function migrate(stored: Record<string, unknown>): Envelope {
  const version = typeof stored.schemaVersion === 'number' ? stored.schemaVersion : 0

  // Future versions of the app should not clobber progress written by a newer
  // one, and version 0 never shipped, so both fall back rather than guess.
  if (version !== SCHEMA_VERSION) return structuredClone(EMPTY)

  const progress: Envelope['progress'] = {}
  if (isRecord(stored.progress)) {
    for (const [game, dexes] of Object.entries(stored.progress)) {
      if (!isRecord(dexes)) continue
      progress[game] = {}
      for (const [dex, value] of Object.entries(dexes)) {
        if (!isRecord(value) || !Array.isArray(value.caught)) continue
        const caught = value.caught.filter((n): n is number => Number.isInteger(n))
        progress[game][dex] = {
          caught,
          updatedAt:
            typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
          // Additive with a correct default, like `owner` above: an envelope
          // written before this existed holds marks that were attributed to
          // its owner at the time, and claiming otherwise now would hand them
          // to the next account signed in here.
          anonymous: Array.isArray(value.anonymous)
            ? value.anonymous.filter((n): n is number => Number.isInteger(n) && caught.includes(n))
            : [],
        }
      }
    }
  }

  const settings = isRecord(stored.settings) ? stored.settings : {}

  return {
    schemaVersion: SCHEMA_VERSION,
    // Absent means anonymous, which is exactly what every envelope written
    // before accounts existed is. That is why adding this needed no version
    // bump: the field is additive and its missing value is the correct one, so
    // nobody's dex is thrown away to introduce it.
    owner: typeof stored.owner === 'string' ? stored.owner : null,
    settings: {
      sound: settings.sound === true,
      // Only an explicit, recognised choice overrides the default — anything
      // else falls back rather than being trusted into a CSS attribute
      // selector that would then match nothing. A saved 'violet' survives;
      // a missing or corrupt value lands on scarlet like a new visitor.
      theme: settings.theme === 'violet' ? 'violet' : DEFAULT_THEME,
    },
    progress,
  }
}

/**
 * One in-memory envelope is the source of truth for the session.
 *
 * Re-reading localStorage on every save would be wrong, not just slow: while a
 * debounced write is pending, storage still holds the previous value, so a save
 * that read it back would build its envelope from stale data and then cancel
 * the pending write. Marking a Pokemon within 300ms of toggling sound would
 * silently discard the sound change.
 */
let envelope: Envelope | undefined

function state(): Envelope {
  envelope ??= read()
  return envelope
}

let pendingWrite: ReturnType<typeof setTimeout> | undefined

function persist(): void {
  clearTimeout(pendingWrite)
  pendingWrite = undefined
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state()))
  } catch {
    // Quota exceeded or storage blocked. In-memory state is still correct, so
    // the session continues; there is nothing useful to tell the user.
  }
}

/** Toggling a run of entries should not mean a write per entry. */
function schedulePersist(): void {
  clearTimeout(pendingWrite)
  pendingWrite = setTimeout(persist, WRITE_DEBOUNCE_MS)
}

/**
 * Whether there is an account to mirror to. Progress is written locally either
 * way — signing out drops the copy, never the dex.
 */
let signedIn = false

/** Dexes changed since the last push. The whole list is sent, never a delta. */
const unpushed = new Map<string, { game: GameId; dex: DexId }>()

let pendingPush: ReturnType<typeof setTimeout> | undefined

/** Resolves when every queued list has been sent, successfully or not. */
function push(keepalive = false): Promise<void> {
  clearTimeout(pendingPush)
  pendingPush = undefined

  const sending = [...unpushed.values()].map(({ game, dex }) => {
    const caught = state().progress[game]?.[dex]?.caught ?? []
    // Best effort, and deliberately unreported. The device's copy is the truth,
    // and every push sends the whole list, so a failed one is superseded by the
    // next change and repaired by the union on the next merge.
    return api.putProgress(game, dex, caught, keepalive).catch(() => {})
  })

  unpushed.clear()
  return Promise.all(sending).then(() => undefined)
}

function queuePush(game: GameId, dex: DexId): void {
  if (!signedIn) return
  unpushed.set(`${game}/${dex}`, { game, dex })
  clearTimeout(pendingPush)
  pendingPush = setTimeout(() => void push(), PUSH_DEBOUNCE_MS)
}

/**
 * Sends anything still owed to the account and waits for it to land.
 *
 * Signing out must call this **first**, while the cookie is still valid: once
 * the logout request returns the session is gone and a push answers 401. This
 * used to cancel the pending push instead, which silently threw away every mark
 * made in the two seconds before signing out — including, on a fresh account,
 * the entire dex the merge had just queued.
 */
export function flushProgress(): Promise<void> {
  if (pendingWrite !== undefined) persist()
  return push()
}

if (typeof window !== 'undefined') {
  // Without this, closing the tab within the debounce window loses the last
  // toggle. pagehide fires on close, navigation, and mobile backgrounding,
  // which is the case that actually bites.
  window.addEventListener('pagehide', () => {
    if (pendingWrite !== undefined) persist()
    // keepalive is what lets the request outlive the page. A normal fetch is
    // cancelled on unload, so the server would miss the last few marks until
    // something else triggered a merge. Nothing can be awaited here, which is
    // exactly why signing out gets its own flush rather than relying on this.
    if (pendingPush !== undefined) void push(true)
  })
}

/**
 * Called when the account changes, including to nobody.
 *
 * Signing out leaves local progress *and its owner* exactly as they are. The
 * dex stays on the device — logging out must not look like losing it — and the
 * owner tag is what stops the next account signed in here from absorbing it.
 */
export function setAccount(userId: string | null): void {
  signedIn = userId !== null
  if (signedIn) return

  // A safety net, not the way progress reaches the account on sign-out —
  // `flushProgress` has already run by the time this does. What is left here is
  // for the paths where pushing is pointless anyway, such as a session the
  // server has stopped accepting: the cookie is invalid, so a push would 401.
  clearTimeout(pendingPush)
  pendingPush = undefined
  unpushed.clear()
}

/** Caught national dex numbers for one dex, as a set for O(1) lookups. */
export function loadCaught(game: GameId, dex: DexId): Set<number> {
  return new Set(state().progress[game]?.[dex]?.caught ?? [])
}

/**
 * What is still nobody's, after this write.
 *
 * Signed in there is nothing: every mark is queued for the account as it is
 * made. Signed out they accumulate, so that signing in later can adopt exactly
 * what was marked without an account and nothing else — including on a device
 * where somebody else's dex is sitting in the same envelope.
 */
function unattributed(previous: DexProgress | undefined, caught: Set<number>): number[] {
  if (signedIn) return []

  const before = new Set(previous?.caught ?? [])
  // Unmarking has to drop the number from here too, or signing in would put
  // back the one thing that was deliberately cleared.
  const kept = (previous?.anonymous ?? []).filter((n) => caught.has(n))
  const added = [...caught].filter((n) => !before.has(n))

  return [...new Set([...kept, ...added])].sort((a, b) => a - b)
}

function writeCaught(game: GameId, dex: DexId, caught: Set<number>): void {
  const current = state()
  current.progress[game] ??= {}
  const previous = current.progress[game][dex]

  current.progress[game][dex] = {
    // Sorted so the stored value stays readable and diffs stay small.
    caught: [...caught].sort((a, b) => a - b),
    updatedAt: new Date().toISOString(),
    anonymous: unattributed(previous, caught),
  }
  schedulePersist()
}

export function saveCaught(game: GameId, dex: DexId, caught: Set<number>): void {
  writeCaught(game, dex, caught)
  queuePush(game, dex)
}

/**
 * Reconciles this device with the account, and returns what to show.
 *
 * What happens depends on who the local progress belongs to, which is the whole
 * reason the envelope carries an owner:
 *
 * - **Nobody** — union. This is the case the design exists for: weeks of
 *   anonymous use, then an account, and none of it thrown away.
 * - **This account** — union. It is your own device, and it may hold marks made
 *   while it was offline.
 * - **Another account** — the server's list replaces it, and takes with it
 *   whatever was marked here while nobody was signed in. Signing in has to show
 *   what the account actually holds; a device someone else has used must not
 *   quietly donate their marks to you, and the marks made with no account open
 *   were never theirs to be donated.
 *
 * The union's cost is stated in src/backend/README.md and accepted there: last
 * write wins on the whole list, so unmarking on one device while another is
 * offline can be undone. It needs two devices, an offline edit and an unmark to
 * show up at all, and the fix is additive.
 */
export async function mergeWithServer(
  game: GameId,
  dex: DexId,
  userId: string,
): Promise<Set<number>> {
  const remote = await api.getProgress(game, dex)
  const current = state()

  if (current.owner !== null && current.owner !== userId) {
    // What was marked while nobody was signed in is not theirs. It was made by
    // whoever is at this device now, which is this account, so it survives the
    // takeover and goes up with everything else.
    const mine = new Set(current.progress[game]?.[dex]?.anonymous ?? [])

    // Everything else goes, and every dex, not only this one: the rest of the
    // envelope was theirs, and a dex left behind here would be merged into this
    // account the first time it is opened. Only this dex keeps its anonymous
    // marks — the app has one, and the next merge is what would carry another.
    current.owner = userId
    current.progress = {}

    const theirs = new Set([...remote, ...mine])
    writeCaught(game, dex, theirs)

    if (theirs.size !== remote.length) queuePush(game, dex)
    return theirs
  }

  const merged = new Set([...loadCaught(game, dex), ...remote])
  current.owner = userId
  writeCaught(game, dex, merged)

  // The union always contains the server's list, so equal sizes mean it already
  // had everything and there is nothing to send back. Without this, merely
  // opening the page while signed in would write to the database every time.
  if (merged.size !== remote.length) queuePush(game, dex)

  return merged
}

export function loadSound(): boolean {
  return state().settings.sound
}

export function saveSound(sound: boolean): void {
  state().settings.sound = sound
  schedulePersist()
}

export function loadTheme(): Theme {
  return state().settings.theme
}

export function saveTheme(theme: Theme): void {
  state().settings.theme = theme
  schedulePersist()
}
