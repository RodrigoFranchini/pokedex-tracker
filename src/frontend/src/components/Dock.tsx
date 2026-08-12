import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import type { User } from '../lib/api'
import type { CaughtFilter } from '../types'
import styles from './Dock.module.css'

const STATUSES: CaughtFilter[] = ['all', 'caught', 'missing']

type Props = {
  query: string
  onQueryChange: (value: string) => void
  status: CaughtFilter
  onStatusChange: (value: CaughtFilter) => void
  user: User | null
  onOpenAccount: () => void
}

/**
 * The phone's control bar, fixed to the bottom edge.
 *
 * Search and caught status are the two things you touch constantly, so on a
 * phone they belong under the thumb rather than above 400 rows. Version and
 * type are set once and stay in the toolbar. Nothing here is a second source of
 * truth: these controls drive the same filter state the toolbar does, and the
 * two are never on screen together.
 */
export function Dock({
  query,
  onQueryChange,
  status,
  onStatusChange,
  user,
  onOpenAccount,
}: Props) {
  // Open if a query survived from a wider layout, so a filter is never applied
  // with nothing on screen to say why.
  const [searching, setSearching] = useState(query !== '')
  const fieldRef = useRef<HTMLInputElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  /*
   * `fixed` pins to the layout viewport, which on a phone is not where the
   * bottom of the screen is: the browser's own bar and the keyboard sit over
   * it, and iOS moves the visual viewport during a scroll without moving fixed
   * elements with it — which is the bar drifting as the page settles.
   *
   * So measure what is covered and lift the bar by exactly that. On a browser
   * that shrinks the layout instead, the gap is zero and this does nothing.
   */
  useEffect(() => {
    const viewport = window.visualViewport
    const dock = dockRef.current
    if (!viewport || !dock) return

    function update() {
      // How much of the layout viewport is hidden below the visible one.
      const covered = window.innerHeight - (viewport!.height + viewport!.offsetTop)
      // Under a pixel is rounding, and an empty string keeps the style
      // attribute clean rather than parking a translateY(0) on it.
      dock!.style.transform = covered > 1 ? `translateY(${-covered}px)` : ''
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)

    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  // Closing clears, the way Escape does everywhere else on the page. Leaving a
  // query applied with no field on screen is the one outcome to avoid.
  function toggleSearch() {
    if (searching) {
      onQueryChange('')
      setSearching(false)
      return
    }

    // flushSync, so the field exists and takes focus inside the tap that asked
    // for it. Focusing from an effect happens after the gesture is over, and
    // iOS opens the keyboard only for a focus that came from the gesture — the
    // field would appear and then sit there waiting for a second tap.
    flushSync(() => setSearching(true))
    fieldRef.current?.focus()
  }

  return (
    <div ref={dockRef} className={styles.dock}>
      <div className={styles.face}>
        {searching && (
          <input
            ref={fieldRef}
            className={styles.field}
            type="search"
            value={query}
            placeholder="Search name or number"
            aria-label="Search name or number"
            onChange={(event) => onQueryChange(event.target.value)}
            // Tapping the list with nothing typed puts the rows back; a query
            // that is doing something keeps its field.
            onBlur={() => {
              if (!query) setSearching(false)
            }}
          />
        )}

        <div className={styles.bar}>
          <button
            type="button"
            className={styles.slot}
            aria-expanded={searching}
            aria-label={searching ? 'Clear search' : 'Search'}
            // Keeps the press from moving focus, which is what makes closing
            // work: otherwise the field blurs first, the empty-field rule below
            // collapses the strip, and the click then lands on a button that
            // has already become the lens again — closing search reopened it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggleSearch}
          >
            {searching ? (
              '✕'
            ) : (
              <svg className={styles.glyph} viewBox="0 0 16 16" aria-hidden="true">
                {/* The lens carries the page's notch, so the one drawn shape on
                    the page is made of the same corner as every surface. */}
                <path d="M2 2H7L9 4V9H2Z" />
                <path d="M9 9L14 14" />
              </svg>
            )}
          </button>

          <div className={styles.segmented} role="group" aria-label="Caught status">
            {STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                className={styles.segment}
                aria-pressed={status === option}
                onClick={() => onStatusChange(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.slot}
            aria-label={user ? `Account, signed in as ${user.email}` : 'Log in'}
            onClick={onOpenAccount}
          >
            {/* A notched card, and filled when you are signed in: empty outline
                against solid is how this page already says caught or not. */}
            <svg
              className={`${styles.glyph} ${user ? styles.glyphFilled : ''}`}
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path d="M2 4H10L14 8V12H2Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
