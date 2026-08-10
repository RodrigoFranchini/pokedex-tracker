import { useCallback, useEffect, useRef, useState } from 'react'

import * as api from '../lib/api'
import type { User } from '../lib/api'

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

  useEffect(() => {
    // A ref rather than a plain flag: development invokes effects twice, and
    // paying for two cold starts is the exact thing the ping exists to avoid.
    if (started.current) return
    started.current = true

    void api.wake().then(() => setWaking(false))

    // An expired or missing cookie answers null. A network failure throws, and
    // is swallowed: being offline is an ordinary state here, not news.
    void api.me().then(setUser, () => {})
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    setUser(await api.register(email, password))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password))
  }, [])

  const logout = useCallback(async () => {
    // The cookie is cleared by the response, so the local state only follows a
    // success. Signing out optimistically would show a signed-out header that
    // the next page load silently undoes.
    await api.logout()
    setUser(null)
  }, [])

  return { user, waking, register, login, logout }
}
