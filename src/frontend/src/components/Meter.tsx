import { memo } from 'react'

import type { DexEntry } from '../types'
import styles from './Meter.module.css'

type Props = {
  entries: readonly DexEntry[]
  caught: Set<number>
  /** Jump the list to the dex number the user clicked. */
  onSeek: (dexNumber: number) => void
}

function MeterComponent({ entries, caught, onSeek }: Props) {
  const total = entries.length
  const done = entries.filter((entry) => caught.has(entry.nationalNumber)).length

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const fraction = (event.clientX - bounds.left) / bounds.width
    const target = Math.round(fraction * total)
    onSeek(Math.max(1, Math.min(target, total)))
  }

  return (
    <div
      // A full meter is already the trophy; the sweep is only there to say the
      // last segment landed. It replays on reload, which is the price of
      // holding no "already celebrated" state anywhere.
      className={`${styles.meter} ${done === total ? styles.complete : ''}`}
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuetext={`${done} of ${total} caught`}
      // Click-to-jump is a pointer shortcut. Keyboard users navigate the list
      // itself with Home, End, PageUp and PageDown, which reach the same rows.
      onClick={handleClick}
    >
      {entries.map((entry) => (
        <span
          key={entry.dexNumber}
          className={`${styles.segment} ${
            caught.has(entry.nationalNumber) ? styles.filled : ''
          }`}
        />
      ))}
      <span className={styles.ticks} />
    </div>
  )
}

/** 400 segments rebuild on every toggle otherwise. */
export const Meter = memo(MeterComponent)
