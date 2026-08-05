import { useState } from 'react'
import type { RefObject } from 'react'

import type { CaughtFilter, VersionFilter } from '../types'
import { TypeBadge } from './TypeBadge'
import styles from './Toolbar.module.css'

const STATUSES: CaughtFilter[] = ['all', 'caught', 'missing']

const VERSIONS = [
  { value: 'scarlet', className: 'scarlet' },
  { value: 'violet', className: 'violet' },
] as const

type Props = {
  query: string
  onQueryChange: (value: string) => void
  status: CaughtFilter
  onStatusChange: (value: CaughtFilter) => void
  version: VersionFilter
  onVersionChange: (value: VersionFilter) => void
  allTypes: string[]
  selectedTypes: Set<string>
  onToggleType: (type: string) => void
  searchRef: RefObject<HTMLInputElement | null>
}

export function Toolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  version,
  onVersionChange,
  allTypes,
  selectedTypes,
  onToggleType,
  searchRef,
}: Props) {
  // Eighteen chips shown at all times would outweigh the list they filter.
  const [typesOpen, setTypesOpen] = useState(false)

  return (
    <div className={styles.toolbar}>
      <input
        ref={searchRef}
        className={styles.search}
        type="search"
        value={query}
        placeholder="Search name or number"
        aria-label="Search name or number"
        onChange={(event) => onQueryChange(event.target.value)}
      />

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

      <div className={styles.versions} role="group" aria-label="Version exclusives">
        {VERSIONS.map(({ value, className }) => (
          <button
            key={value}
            type="button"
            className={`${styles.version} ${styles[className]}`}
            aria-pressed={version === value}
            // Clicking the active chip clears the filter, so "no selection"
            // and "show everything" are the same state.
            onClick={() => onVersionChange(version === value ? 'all' : value)}
          >
            {value}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.typesToggle}
        aria-expanded={typesOpen}
        onClick={() => setTypesOpen((open) => !open)}
      >
        Type {selectedTypes.size > 0 ? `(${selectedTypes.size})` : ''} ▾
      </button>

      {typesOpen && (
        <div className={styles.typeGrid} role="group" aria-label="Filter by type">
          {allTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={styles.typeChip}
              aria-pressed={selectedTypes.has(type)}
              onClick={() => onToggleType(type)}
            >
              <TypeBadge type={type} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
