import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { ApiError } from '../lib/api'
import type { User } from '../lib/api'
import styles from './AuthDialog.module.css'

type Props = {
  user: User | null
  /** The warm-up ping has not answered yet, so the server is provably asleep. */
  waking: boolean
  onRegister: (email: string, password: string) => Promise<void>
  onLogin: (email: string, password: string) => Promise<void>
  onLogout: () => Promise<void>
  onClose: () => void
}

/**
 * Long enough that a warm server never trips it. Login is not a fast endpoint
 * even awake — bcrypt, on a throttled free instance, across the Atlantic —
 * and measured between 0.8s and 2.3s. A cold start is around ten times that,
 * so anything past this really is the wait worth explaining.
 */
const SLOW_REQUEST_MS = 4000

/** The server's own rule, checked here to save a round trip that may be slow. */
const MIN_PASSWORD = 8
const MAX_PASSWORD = 72

/**
 * The whole fix for the cold start is this line. An explained wait reads as
 * self-aware; a frozen button reads as broken. It says how long and stops
 * there — why the hosting is slow is not the waiting person's problem.
 */
const WAKING_MESSAGE = 'Waking the server. Up to a minute.'

/** One frame per --snap step, so the pointer waits in the page's own rhythm. */
const WAIT_FRAME_MS = 80
const WAIT_FRAMES = 4

export function AuthDialog({ user, waking, onRegister, onLogin, onLogout, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const frame = useRef(0)

  const [creating, setCreating] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // showModal, not the open attribute: it is what gives the backdrop, the focus
  // trap and Escape, none of which are worth reimplementing.
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  // The pointer's frame is written straight onto the element rather than held
  // in state: a cold start runs for a minute, and re-rendering the form twelve
  // times a second to move a cursor would be a lot of work for the same pixels.
  useEffect(() => {
    const dialog = ref.current
    if (!pending || !dialog) return

    frame.current = 0
    dialog.style.setProperty('--wait-frame', 'var(--cursor-wait-0)')

    // A pointer flickering at 12fps is exactly what asking for less motion
    // means; the first frame alone still says busy.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = still
      ? undefined
      : setInterval(() => {
          frame.current = (frame.current + 1) % WAIT_FRAMES
          dialog.style.setProperty('--wait-frame', `var(--cursor-wait-${frame.current})`)
        }, WAIT_FRAME_MS)

    return () => {
      clearInterval(timer)
      dialog.style.removeProperty('--wait-frame')
    }
  }, [pending])

  async function run(action: () => Promise<void>) {
    setError(null)
    setPending(true)

    // If the warm-up ping has not come back, the instance is still cold and we
    // can say so at once. Otherwise wait a beat before calling it asleep when
    // it might just be a slow connection.
    const timer = setTimeout(() => setSlow(true), waking ? 0 : SLOW_REQUEST_MS)

    try {
      await action()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not reach the server. Your progress is safe on this device.',
      )
      return
    } finally {
      clearTimeout(timer)
      setPending(false)
      setSlow(false)
    }

    onClose()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(() => (creating ? onRegister : onLogin)(email, password))
  }

  const notices = (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {slow && <p className={styles.waking}>{WAKING_MESSAGE}</p>}
    </>
  )

  let title = 'Log in'
  let submit = 'Log in'
  let working = 'Logging in…'
  if (user) {
    title = 'Account'
    submit = 'Log out'
    working = 'Logging out…'
  } else if (creating) {
    title = 'Create account'
    submit = 'Create account'
    working = 'Creating…'
  }

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${pending ? styles.waiting : ''}`}
      onClose={onClose}
    >
      {/* The head sits on the ink rather than in the panel, so the dialog is
          the same object as the plate that opened it: a title bar over a face. */}
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.body}>
        {user ? (
          <>
            <p className={styles.blurb}>
              Signed in as <b className={styles.email}>{user.email}</b>
            </p>

            {notices}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.submit}
                disabled={pending}
                onClick={() => void run(onLogout)}
              >
                {pending ? working : submit}
              </button>
            </div>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {/* Before the fields, not after: someone deciding whether to hand
                over an address should know what it buys. One line, and it says
                the one thing an account does — the corner plate no longer
                implies anything about where the dex is saved. */}
            <p className={styles.blurb}>An account keeps your dex on your other devices.</p>

            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                className={styles.input}
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Password</span>
              <input
                className={styles.input}
                type="password"
                value={password}
                required
                minLength={creating ? MIN_PASSWORD : undefined}
                maxLength={MAX_PASSWORD}
                autoComplete={creating ? 'new-password' : 'current-password'}
                onChange={(event) => setPassword(event.target.value)}
              />
              {creating && <span className={styles.hint}>At least {MIN_PASSWORD} characters</span>}
            </label>

            {notices}

            <div className={styles.actions}>
              <button type="submit" className={styles.submit} disabled={pending}>
                {pending ? working : submit}
              </button>

              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setCreating((value) => !value)
                  setError(null)
                }}
              >
                {creating ? 'I already have an account' : 'Create an account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}
