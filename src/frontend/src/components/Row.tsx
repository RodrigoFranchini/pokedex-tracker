import { memo } from 'react'

import { spriteUrl } from '../lib/sprites'
import type { DexEntry } from '../types'
import { Mark } from './Mark'
import { TypeBadge } from './TypeBadge'
import styles from './Row.module.css'

type Props = {
  entry: DexEntry
  /** Position in the *visible* list — the cursor's coordinate space. */
  index: number
  caught: boolean
  flash: boolean
  /**
   * This row holds the cursor. Drives both the visible selection and the
   * roving tabindex, so only the cursor's row is reachable with Tab.
   */
  active: boolean
  onToggle: (entry: DexEntry) => void
  onFocus: (index: number) => void
}

function RowComponent({ entry, index, caught, flash, active, onToggle, onFocus }: Props) {
  return (
    <li>
      <button
        type="button"
        className={[styles.row, caught && styles.caught, active && styles.active]
          .filter(Boolean)
          .join(' ')}
        // Read by useCursor to move focus without holding 400 refs.
        data-row={index}
        aria-pressed={caught}
        tabIndex={active ? 0 : -1}
        onClick={() => onToggle(entry)}
        onFocus={() => onFocus(index)}
      >
        <span className={styles.cursor} aria-hidden="true">
          ▶
        </span>

        <span className={styles.number}>
          {String(entry.dexNumber).padStart(3, '0')}
        </span>

        <img
          className={styles.sprite}
          src={spriteUrl(entry.spriteId)}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
        />

        <span className={styles.stack}>
          <span className={styles.name}>{entry.name}</span>
          <span className={styles.types}>
            {entry.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </span>
        </span>

        <Mark caught={caught} flash={flash} />
      </button>
    </li>
  )
}

/**
 * Toggling one row re-renders the list; without this every one of the other
 * 399 rows would rebuild its sprite and badges for nothing.
 */
export const Row = memo(RowComponent)
