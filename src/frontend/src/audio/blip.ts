/**
 * Two short blips, synthesised. No audio files, no dependency.
 *
 * Square waves with a hard attack and a fast decay: the shape a 4-operator
 * chip would have produced, and the reason it reads as retro rather than as a
 * notification sound.
 */

let context: AudioContext | undefined

/**
 * Created on first play, not at import. Browsers suspend contexts made before a
 * user gesture, and an app that never plays a sound should never make one.
 */
function getContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  context ??= new AudioContext()
  if (context.state === 'suspended') void context.resume()
  return context
}

function tone(frequency: number, durationMs: number): void {
  const ctx = getContext()
  if (!ctx) return

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'square'
  oscillator.frequency.value = frequency

  const now = ctx.currentTime
  const duration = durationMs / 1000

  // Quiet enough to survive being triggered twenty times in a row, and ramped
  // to zero rather than cut, which would click.
  gain.gain.setValueAtTime(0.05, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + duration)
}

/** Marking something caught: up. */
export function playMark(): void {
  tone(880, 70)
}

/** Undoing it: down, and shorter, so the two are never confused. */
export function playUnmark(): void {
  tone(440, 50)
}
