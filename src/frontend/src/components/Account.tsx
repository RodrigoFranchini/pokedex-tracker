import type { User } from '../lib/api'
import styles from './Account.module.css'

type Props = {
  user: User | null
  onOpen: () => void
}

/**
 * The account control in the screen's corner. On a phone the dock carries the
 * account instead and this is hidden, which is why it does not own the dialog:
 * one dialog, two triggers, and the state for it lives in App.
 */
export function Account({ user, onOpen }: Props) {
  return (
    // The face names the action, never the storage. "This device" here read as
    // a thing you press to save, which is the local-first promise upside down —
    // what an account is actually for is said in the dialog.
    <button type="button" className={styles.plate} onClick={onOpen}>
      <span className={styles.title}>Account</span>
      <span className={styles.face}>
        <span className={`${styles.value} ${user ? styles.identity : ''}`}>
          {user ? user.email : 'Log in'}
        </span>
      </span>
    </button>
  )
}
