import { useCallback, useEffect, useRef, useState } from 'react'

import { loadCaught, saveCaught } from '../storage/progress'
import type { DexId, GameId } from '../types'

/**
 * Caught state for one dex.
 *
 * State updates immediately and persists after. There is no request to fail and
 * nothing to roll back, so there is no pending or error state to model.
 */
export function useProgress(game: GameId, dex: DexId) {
  const [caught, setCaught] = useState<Set<number>>(() => loadCaught(game, dex))

  /**
   * A functional updater, because marking a run of entries quickly means
   * several clicks land in one tick. Reading `caught` from the closure instead
   * would give every one of them the same pre-render value, and the last click
   * would overwrite the rest.
   */
  const toggle = useCallback((nationalNumber: number) => {
    setCaught((previous) => {
      const next = new Set(previous)
      if (!next.delete(nationalNumber)) next.add(nationalNumber)
      return next
    })
  }, [])

  /** The set loaded at mount. Toggling always produces a new Set, so an
   *  identity check is enough to tell "nothing has happened yet" from a real
   *  change — and unlike a mutable flag it survives React's double-invoked
   *  effects in development. */
  const loaded = useRef(caught)

  /**
   * Persisting here rather than inside the updater keeps the updater pure —
   * React invokes it twice in development to catch exactly that — and still
   * coalesces a burst of toggles into one committed state and one save.
   *
   * Merely opening the page must not write anything. Otherwise a visitor who
   * never marks a thing still gets the current defaults frozen into storage,
   * and any later change to a default silently never reaches them.
   */
  useEffect(() => {
    if (caught === loaded.current) return
    saveCaught(game, dex, caught)
  }, [game, dex, caught])

  return { caught, toggle, count: caught.size }
}
