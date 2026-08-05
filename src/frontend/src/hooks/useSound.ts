import { useCallback, useState } from 'react'

import { playMark, playUnmark } from '../audio/blip'
import { loadSound, saveSound } from '../storage/progress'

/**
 * Sound is off until asked for. Audio that starts without consent is hostile,
 * and a muted default costs someone who wants it exactly one click.
 */
export function useSound() {
  const [enabled, setEnabled] = useState<boolean>(() => loadSound())

  // Side effects stay out of the updater: React invokes updaters twice in
  // development to catch impurity, which would double the blip and the write.
  const toggleEnabled = useCallback(() => {
    const next = !enabled

    setEnabled(next)
    saveSound(next)
    // Play on the enabling click so the choice confirms itself.
    if (next) playMark()
  }, [enabled])

  const play = useCallback(
    (caught: boolean) => {
      if (!enabled) return
      if (caught) playMark()
      else playUnmark()
    },
    [enabled],
  )

  return { enabled, toggleEnabled, play }
}
