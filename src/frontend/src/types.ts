/** One Pokemon in a regional dex. */
export type DexEntry = {
  /** Regional dex number, 1-400 for Paldea. Display and sort order only. */
  dexNumber: number
  /**
   * National dex number. This is identity everywhere else — stored progress,
   * artwork URLs, and any future cross-game feature. Regional numbers are not
   * stable across games (Paldea #1 and Galar #1 are different Pokemon).
   */
  nationalNumber: number
  /** Display name, e.g. "Sprigatito". */
  name: string
  /** API name of the specific variety, e.g. "wooper-paldea". */
  slug: string
  /**
   * The variety's own PokeAPI id, which is what the sprite files are keyed by.
   * Differs from nationalNumber for regional forms — Paldean Wooper is 10253,
   * not 194 — so using the national number here would show the wrong sprite.
   */
  spriteId: number
  /** One or two type names, in slot order. */
  types: string[]
  /**
   * Which version this can be caught in. Hand-curated in the generator, since
   * PokeAPI carries no Scarlet/Violet availability data at all.
   */
  versionExclusive: VersionExclusive
}

/** 'both' means catchable in either game — the case for most of the dex. */
export type VersionExclusive = 'both' | 'scarlet' | 'violet'

/** Which game a dex belongs to. Keys in stored progress. */
export type GameId = 'scarlet-violet'

/** Which dex within a game. Scarlet/Violet has three; Phase 1 ships one. */
export type DexId = 'paldea'

export type CaughtFilter = 'all' | 'caught' | 'missing'

/**
 * 'all' shows the whole dex; picking a version narrows to *only* that version's
 * exclusives. Set it to your own game to see what is catchable, then flip it to
 * build the list of what you need to trade for.
 */
export type VersionFilter = 'all' | 'scarlet' | 'violet'

/** Which game's colour the page wears. Named after the games themselves. */
export type Theme = 'violet' | 'scarlet'

export const THEMES: Theme[] = ['scarlet', 'violet']
