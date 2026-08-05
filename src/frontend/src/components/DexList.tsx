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
  onToggle,
  onFocusRow,
  onClearFilters,
}: Props) {
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
