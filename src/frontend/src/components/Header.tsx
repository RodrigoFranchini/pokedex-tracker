import type { ReactNode } from 'react'

import { THEMES } from '../types'
import type { Theme } from '../types'
import styles from './Header.module.css'

type Props = {
  caught: number
  total: number
  soundEnabled: boolean
  onToggleSound: () => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  /** The account control. A slot rather than five more props, so the header
   *  goes on knowing nothing about accounts. */
  account: ReactNode
}

export function Header({
  caught,
  total,
  soundEnabled,
  onToggleSound,
  theme,
  onThemeChange,
  account,
}: Props) {
  return (
    <header className={styles.header}>
      <h1 className={styles.wordmark}>PALDEA</h1>

      {/*
        The game title doubles as the control that sets the page's colour.
        Each name is the button for its own world, so the label is the whole
        explanation — no swatch or icon needed to say what "Scarlet" does.
      */}
      <div className={styles.games} role="group" aria-label="Page colour">
        {THEMES.map((option, index) => (
          <span key={option}>
            {index > 0 && (
              <span className={styles.amp} aria-hidden="true">
                &amp;
              </span>
            )}
            <button
              type="button"
              className={styles.game}
              aria-pressed={theme === option}
              onClick={() => onThemeChange(option)}
            >
              {option}
            </button>
          </span>
        ))}
      </div>

      <span className={styles.spacer} />

      {account}

      <button
        type="button"
        className={styles.sound}
        aria-pressed={soundEnabled}
        onClick={onToggleSound}
      >
        Sound {soundEnabled ? 'on' : 'off'}
      </button>

      {/* No percentage: the meter already shows the proportion and the count
          shows the number, so a third reading of the same fact would only add
          the oddity of "1 / 400" sitting next to "0%". */}
      <p className={styles.count}>
        <span className={styles.done}>{caught}</span>
        <span className={styles.total}> / {total}</span>
      </p>
    </header>
  )
}
