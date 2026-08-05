import type { CSSProperties } from 'react'

import styles from './TypeBadge.module.css'

type Props = {
  type: string
}

export function TypeBadge({ type }: Props) {
  // The 18 type colours are tokens; the badge just points at the right one.
  const style = { '--type-colour': `var(--type-${type})` } as CSSProperties

  return (
    <span className={styles.badge} style={style}>
      {type}
    </span>
  )
}
