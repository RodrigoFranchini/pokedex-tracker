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
}

type Settings = {
  sound: boolean
  theme: Theme
}

type Envelope = {
  schemaVersion: number
  settings: Settings
  progress: Record<string, Record<string, DexProgress>>
}

/** Scarlet is the world a first-time visitor lands in. */
const DEFAULT_THEME: Theme = 'scarlet'

const EMPTY: Envelope = {
  schemaVersion: SCHEMA_VERSION,
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
        progress[game][dex] = {
          caught: value.caught.filter((n): n is number => Number.isInteger(n)),
          updatedAt:
            typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
        }
      }
    }
  }

  const settings = isRecord(stored.settings) ? stored.settings : {}

  return {
    schemaVersion: SCHEMA_VERSION,
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

function push(keepalive = false): void {
  clearTimeout(pendingPush)
  pendingPush = undefined

  for (const { game, dex } of unpushed.values()) {
    const caught = state().progress[game]?.[dex]?.caught ?? []
    // Best effort, and deliberately unreported. The device's copy is the truth,
    // and every push sends the whole list, so a failed one is superseded by the
    // next change and repaired by the union on the next merge.
    void api.putProgress(game, dex, caught, keepalive).catch(() => {})
  }

  unpushed.clear()
}

function queuePush(game: GameId, dex: DexId): void {
  if (!signedIn) return
  unpushed.set(`${game}/${dex}`, { game, dex })
  clearTimeout(pendingPush)
  pendingPush = setTimeout(push, PUSH_DEBOUNCE_MS)
}

if (typeof window !== 'undefined') {
  // Without this, closing the tab within the debounce window loses the last
  // toggle. pagehide fires on close, navigation, and mobile backgrounding,
  // which is the case that actually bites.
  window.addEventListener('pagehide', () => {
    if (pendingWrite !== undefined) persist()
    // keepalive is what lets the request outlive the page. A normal fetch is
    // cancelled on unload, so the server would miss the last few marks until
    // something else triggered a merge.
    if (pendingPush !== undefined) push(true)
  })
}

/**
 * Called when the account changes, including to nobody.
 *
 * Signing out cancels a pending push and leaves local progress untouched:
 * logging out must not look anything like losing your dex.
 */
export function setSignedIn(value: boolean): void {
  signedIn = value
  if (signedIn) return

  clearTimeout(pendingPush)
  pendingPush = undefined
  unpushed.clear()
}

/** Caught national dex numbers for one dex, as a set for O(1) lookups. */
export function loadCaught(game: GameId, dex: DexId): Set<number> {
  return new Set(state().progress[game]?.[dex]?.caught ?? [])
}

function writeCaught(game: GameId, dex: DexId, caught: Set<number>): void {
  const current = state()
  current.progress[game] ??= {}
  current.progress[game][dex] = {
    // Sorted so the stored value stays readable and diffs stay small.
    caught: [...caught].sort((a, b) => a - b),
    updatedAt: new Date().toISOString(),
  }
  schedulePersist()
}

export function saveCaught(game: GameId, dex: DexId, caught: Set<number>): void {
  writeCaught(game, dex, caught)
  queuePush(game, dex)
}

/**
 * Unions the server's list with this device's and keeps the result, on both
 * sides. Returns the merged set, already persisted.
 *
 * The union is the case that will actually happen: someone uses the app
 * anonymously for weeks and then makes an account. None of that may be thrown
 * away, so a merge only ever adds.
 *
 * The cost of that is stated in src/backend/README.md and accepted there: last
 * write wins on the whole list, so unmarking on one device while another is
 * offline can be undone. It needs two devices, an offline edit and an unmark to
 * show up at all, and the fix is additive.
 */
export async function mergeWithServer(game: GameId, dex: DexId): Promise<Set<number>> {
  const remote = await api.getProgress(game, dex)
  const merged = new Set([...loadCaught(game, dex), ...remote])

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
