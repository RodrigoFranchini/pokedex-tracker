import { useCallback, useEffect, useRef, useState } from 'react'

import { loadCaught, mergeWithServer, saveCaught, setAccount } from '../storage/progress'
import type { DexId, GameId } from '../types'

/**
 * Caught state for one dex.
 *
 * Marking updates state immediately and persists after. There is no request to
 * fail and nothing to roll back, so there is no pending or error state to
 * model — an account changes where a copy ends up, not how marking behaves.
 */
export function useProgress(game: GameId, dex: DexId, userId: string | null) {
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

  /** The last set known to be stored already: what was loaded at mount, or what
   *  a merge has just written. Toggling always produces a new Set, so an
   *  identity check is enough to tell "nothing has happened yet" from a real
   *  change — and unlike a mutable flag it survives React's double-invoked
   *  effects in development. */
  const stored = useRef(caught)

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
    if (caught === stored.current) return
    saveCaught(game, dex, caught)
  }, [game, dex, caught])

  /**
   * Reconcile on sign-in, and on every load while signed in — this is the only
   * way a mark made on another device arrives here.
   *
   * A failure is silence by design. The dex is already on screen and already
   * correct; an account that cannot be reached is not a reason to interrupt
   * someone working through a checklist.
   */
  useEffect(() => {
    setAccount(userId)
    if (userId === null) return

    let live = true
    void mergeWithServer(game, dex, userId).then((merged) => {
      if (!live) return
      // The merge has already written this, so it is the new baseline rather
      // than an edit. Without this the effect above would save it straight back
      // and queue a push the server does not need.
      stored.current = merged
      setCaught(merged)
    }, () => {})

    return () => {
      live = false
    }
  }, [game, dex, userId])

  return { caught, toggle, count: caught.size }
}
