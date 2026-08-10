import { useState } from 'react'

import type { User } from '../lib/api'
import { AuthDialog } from './AuthDialog'
import styles from './Account.module.css'

type Props = {
  user: User | null
  waking: boolean
  onRegister: (email: string, password: string) => Promise<void>
  onLogin: (email: string, password: string) => Promise<void>
  onLogout: () => Promise<void>
}

export function Account({ user, waking, onRegister, onLogin, onLogout }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${user ? styles.identity : ''}`}
        onClick={() => setOpen(true)}
      >
        {user ? user.email : 'Log in'}
      </button>

      {/* Mounted only while open, so the password never outlives the dialog
          that collected it, and every visit starts on the login side. */}
      {open && (
        <AuthDialog
          user={user}
          waking={waking}
          onRegister={onRegister}
          onLogin={onLogin}
          onLogout={onLogout}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
