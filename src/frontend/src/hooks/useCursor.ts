import { useCallback, useEffect, useRef, useState } from 'react'


/**
 * The cursor: one position that is both the visible marker and the DOM focus.
 *
 * Implemented as a roving tabindex, which is the standard pattern for a list of
 * controls and is also how the games did it — one selection at a time, arrows
 * to move, Tab to leave the list entirely rather than to step through 400 rows.
 */
export function useCursor(count: number) {
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  // Filters shrink the list under the cursor. Clamping rather than resetting
  // keeps your place when a filter narrows the view around where you were.
  useEffect(() => {
    setIndex((current) => (count === 0 ? 0 : Math.min(current, count - 1)))
  }, [count])

  const focusRow = useCallback((target: number) => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row="${target}"]`)
    row?.focus()
  }, [])

  /** Moves the cursor and takes focus with it. Used by the meter to jump. */
  const moveTo = useCallback(
    (target: number) => {
      if (count === 0) return
      const clamped = Math.max(0, Math.min(target, count - 1))
      setIndex(clamped)
      focusRow(clamped)
    },
    [count, focusRow],
  )

  /**
   * Listening on the window rather than on the list.
   *
   * The legend tells people the arrows move the cursor, with no caveat about
   * where focus happens to be — so clicking anywhere outside the list must not
   * silently disable them. A handler bound to the list only works while the
   * list holds focus, which is a promise the interface does not make.
   *
   * Typing in a field is the one exception: there the arrows belong to the
   * caret.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return

      const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[event.key]

      if (step !== undefined) {
        // Also stops the page scrolling out from under the cursor.
        event.preventDefault()
        moveTo(index + step)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        moveTo(0)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        moveTo(count - 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, count, moveTo])

  return { index, setIndex, moveTo, listRef }
}
