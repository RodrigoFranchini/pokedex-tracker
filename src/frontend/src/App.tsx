import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DexList } from './components/DexList'
import { Header } from './components/Header'
import { Meter } from './components/Meter'
import { Toolbar } from './components/Toolbar'
import { PALDEA_DEX } from './data/paldea'
import { useCursor } from './hooks/useCursor'
import { useFilters } from './hooks/useFilters'
import { useProgress } from './hooks/useProgress'
import { useSound } from './hooks/useSound'
import { useTheme } from './hooks/useTheme'
import type { DexEntry, DexId, GameId } from './types'
import styles from './App.module.css'

const GAME: GameId = 'scarlet-violet'
const DEX: DexId = 'paldea'

export default function App() {
  const { caught, toggle, count } = useProgress(GAME, DEX)
  const { enabled: soundEnabled, toggleEnabled: toggleSound, play } = useSound()
  const { theme, setTheme } = useTheme()

  const filters = useFilters(PALDEA_DEX, caught)
  const cursor = useCursor(filters.visible.length)

  /** Only the entry just toggled animates, so page load stays still. */
  const [lastToggled, setLastToggled] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const allTypes = useMemo(
    () => [...new Set(PALDEA_DEX.flatMap((entry) => entry.types))].sort(),
    [],
  )

  const handleToggle = useCallback(
    (entry: DexEntry) => {
      const willBeCaught = !caught.has(entry.nationalNumber)
      toggle(entry.nationalNumber)
      setLastToggled(entry.nationalNumber)
      play(willBeCaught)
    },
    [caught, toggle, play],
  )

  /** Meter clicks land on a dex number; the list is indexed by position. */
  const handleSeek = useCallback(
    (dexNumber: number) => {
      const index = filters.visible.findIndex((entry) => entry.dexNumber >= dexNumber)
      cursor.moveTo(index === -1 ? filters.visible.length - 1 : index)
    },
    [filters.visible, cursor],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }

      if (event.key === 'Escape') {
        // Escape clears the search from anywhere, including from inside it.
        filters.setQuery('')
        if (typing) searchRef.current?.blur()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filters])

  return (
    <div className={styles.page}>
      <Header
        caught={count}
        total={PALDEA_DEX.length}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        theme={theme}
        onThemeChange={setTheme}
      />

      <Meter entries={PALDEA_DEX} caught={caught} onSeek={handleSeek} />

      <div className={styles.frame}>
        <div className={styles.panel}>
          <Toolbar
            query={filters.query}
            onQueryChange={filters.setQuery}
            status={filters.status}
            onStatusChange={filters.setStatus}
            version={filters.version}
            onVersionChange={filters.setVersion}
            allTypes={allTypes}
            selectedTypes={filters.types}
            onToggleType={filters.toggleType}
            searchRef={searchRef}
          />

          <DexList
            entries={filters.visible}
            caught={caught}
            lastToggled={lastToggled}
            cursor={cursor.index}
            listRef={cursor.listRef}
            // Types are AND, and nothing has three, so this combination is
            // empty by definition rather than by accident.
            emptyHint={
              filters.types.size > 2
                ? 'A Pokemon has at most two types, so more than two selected can never match.'
                : undefined
            }
            onToggle={handleToggle}
            onFocusRow={cursor.setIndex}
            onClearFilters={filters.clear}
          />
        </div>
      </div>

      {/* Each label names exactly what its key does. "Esc clear" was read as
          "clear this Pokemon", which is not what the key does — and nothing
          said that the mark key is also how you undo a mark. */}
      <p className={styles.legend}>
        <span>
          <b>↑↓</b> move
        </span>
        <span>
          <b>Space</b> or <b>Enter</b> mark / unmark
        </span>
        <span>
          <b>/</b> search
        </span>
        <span>
          <b>Esc</b> clear search
        </span>
      </p>
    </div>
  )
}
