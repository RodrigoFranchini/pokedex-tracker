import styles from './Mark.module.css'

type Props = {
  caught: boolean
  /** True only for the entry the user just toggled, so page load stays still. */
  flash: boolean
}

export function Mark({ caught, flash }: Props) {
  const className = [styles.mark, caught && styles.filled, flash && styles.flash]
    .filter(Boolean)
    .join(' ')

  // Decorative: the row's aria-pressed already announces the state.
  return <span className={className} aria-hidden="true" />
}
