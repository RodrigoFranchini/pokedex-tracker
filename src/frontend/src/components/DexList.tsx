import type { RefObject } from 'react'

import type { DexEntry } from '../types'
import { Row } from './Row'
import styles from './DexList.module.css'

type Props = {
  entries: readonly DexEntry[]
  caught: Set<number>
  lastToggled: number | null
  cursor: number
  listRef: RefObject<HTMLUListElement | null>
  /** Explains an empty result the filters alone would not account for. */
  emptyHint?: string
  /**
   * The dex is finished, and that is why this list is empty — nothing is
   * missing to show. The empty state is a result here, not a mistake, so it
   * must not read as one.
   */
  complete: boolean
  onToggle: (entry: DexEntry) => void
  onFocusRow: (index: number) => void
  onClearFilters: () => void
}

export function DexList({
  entries,
  caught,
  lastToggled,
  cursor,
  listRef,
  emptyHint,
  complete,
  onToggle,
  onFocusRow,
  onClearFilters,
}: Props) {
  if (entries.length === 0 && complete) {
    return (
      <div className={styles.empty}>
        {/* Straight-faced on purpose. The page never raises its voice, and a
            row of exclamation marks here would read as a different app
            congratulating you. The joke is that finishing 400 entries is
            reported in the same tone as a failed filter. */}
        <p className={styles.emptyDone}>Missing: 0. Caught: 400.</p>
        <p className={styles.emptyText}>
          The professor has no further questions. You may now go outside.
        </p>
        {/* Same action as the filter reset, named for what it does from here:
            you are not fixing a mistake, you are going back to the collection
            you just finished. */}
        <button type="button" className={styles.clear} onClick={onClearFilters}>
          Back to all 400
        </button>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No Pokemon match these filters.</p>
        {emptyHint && <p className={styles.emptyText}>{emptyHint}</p>}
        <button type="button" className={styles.clear} onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    )
  }

  return (
    <ul className={styles.list} ref={listRef}>
      {entries.map((entry, index) => (
        <Row
          key={entry.dexNumber}
          entry={entry}
          index={index}
          caught={caught.has(entry.nationalNumber)}
          flash={lastToggled === entry.nationalNumber}
          active={index === cursor}
          onToggle={onToggle}
          onFocus={onFocusRow}
        />
      ))}
    </ul>
  )
}
