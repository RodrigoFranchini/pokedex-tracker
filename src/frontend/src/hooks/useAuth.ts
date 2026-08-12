import { useCallback, useEffect, useRef, useState } from 'react'

import * as api from '../lib/api'
import type { User } from '../lib/api'
import { flushProgress } from '../storage/progress'

/**
 * Shown when the sign-in worked and the browser threw the cookie away. Names
 * the cause, because the fix is the address the page is being served from and
 * nothing the person can do inside the app.
 */
const SESSION_NOT_KEPT =
  'Signed in, but this browser would not keep the session. The page has to be served over HTTPS or localhost.'

/**
 * Who you are, if anyone.
 *
 * An account is an upgrade for durability, never a gate, so every failure in
 * here leaves `user` null and the app completely usable. Nothing about the dex
 * depends on this hook resolving, or on there being a server at all.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)

  /** True until the warm-up ping settles, which is as long as a cold start. */
  const [waking, setWaking] = useState(true)

  const started = useRef(false)

  /**
   * Set once the user has explicitly signed in or out, which makes the answer
   * to the probe below irrelevant however it comes back.
   */
  const decided = useRef(false)

  useEffect(() => {
    // The server rejecting a call we thought was authenticated means the
    // session is not real, whatever the plate says. Showing an address while
    // every request is anonymous is the failure that hid two sync bugs.
    api.setSessionLostHandler(() => setUser(null))
  }, [])

  useEffect(() => {
    // A ref rather than a plain flag: development invokes effects twice, and
    // paying for two cold starts is the exact thing the ping exists to avoid.
    if (started.current) return
    started.current = true

    void api.wake().then(() => setWaking(false))

    // An expired or missing cookie answers null. A network failure throws, and
    // is swallowed: being offline is an ordinary state here, not news.
    //
    // A cold start can leave this outstanding for half a minute, so it is
    // routine for someone to sign in — or out — before it lands. It went out
    // before either happened, so once they have, its answer is about a session
    // that no longer exists in either direction: stale null would put the plate
    // back to "Log in" after a good sign-in, and stale user would sign someone
    // back in after they signed out.
    void api.me().then((found) => {
      if (decided.current) return
      setUser(found)
    }, () => {})
  }, [])

  /**
   * Signing in is not finished when the server says yes — it is finished when
   * the browser has kept the cookie that says so.
   *
   * The cookie is `Secure`, and a browser drops a `Secure` cookie from any
   * origin it does not consider secure: a plain-http LAN address, which is
   * exactly how this gets opened on a phone. Login still answers 200, so
   * without this the app claims to be signed in while every later request is
   * anonymous, nothing ever syncs, and nothing says why.
   *
   * Only checked where it can actually happen, so an ordinary login over HTTPS
   * or localhost still costs one request rather than two.
   */
  const signIn = useCallback(async (call: () => Promise<User>) => {
    decided.current = true
    const account = await call()

    if (!window.isSecureContext && !(await api.me())) {
      throw new api.ApiError(401, SESSION_NOT_KEPT)
    }

    setUser(account)
  }, [])

  const register = useCallback(
    (email: string, password: string) => signIn(() => api.register(email, password)),
    [signIn],
  )

  const login = useCallback(
    (email: string, password: string) => signIn(() => api.login(email, password)),
    [signIn],
  )

  const logout = useCallback(async () => {
    decided.current = true

    // Order is the whole point. Anything still queued for the account has to go
    // up while the cookie is valid, because api.logout() invalidates it and a
    // push after that answers 401. Sign in on a device holding a finished dex
    // and sign straight back out, and this is what stands between the account
    // keeping it and never seeing it at all.
    await flushProgress()

    // The cookie is cleared by the response, so the local state only follows a
    // success. Signing out optimistically would show a signed-out header that
    // the next page load silently undoes.
    await api.logout()
    setUser(null)
  }, [])

  return { user, waking, register, login, logout }
}
