/**
 * The only module that talks to the server.
 *
 * Every path here is origin-relative, because the API is same-origin: the Vite
 * proxy in development, Vercel's rewrite in production. There is no base URL to
 * configure and no CORS anywhere, which is what lets the auth cookie be
 * first-party. A path that starts with anything but `/api` is a bug.
 */

import type { DexId, GameId } from '../types'

/** An account. The server never returns more than this about one. */
export type User = {
  id: string
  email: string
}

/**
 * A refusal the server explained. Anything else thrown out of this module is
 * the network, which is a different thing to tell the user about.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * Every error the API produces is `{ message }`, whatever raised it. A 502 from
 * the host while the container restarts is not, so parsing is allowed to fail.
 */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const { message } = body as { message: unknown }
      if (typeof message === 'string' && message) return message
    }
  } catch {
    // Not JSON, so there is nothing the server meant us to show.
  }
  return 'Something went wrong. Please try again.'
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    // The JWT is in an httpOnly cookie, which fetch omits by default. Without
    // this every authenticated call is a 401 and nothing says why.
    credentials: 'include',
  })

  if (!response.ok) throw new ApiError(response.status, await errorMessage(response))
  return response
}

export async function register(email: string, password: string): Promise<User> {
  const response = await send('/api/auth/register', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  })
  return response.json()
}

export async function login(email: string, password: string): Promise<User> {
  const response = await send('/api/auth/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  })
  return response.json()
}

export async function logout(): Promise<void> {
  await send('/api/auth/logout', { method: 'POST' })
}

/** The signed-in account, or null when there is no valid cookie. */
export async function me(): Promise<User | null> {
  try {
    const response = await send('/api/me')
    return await response.json()
  } catch (error) {
    // No cookie is an answer, not a failure. Only the network reaching nobody
    // is worth propagating.
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/** The caught list the server holds for one dex. Empty is a valid answer. */
export async function getProgress(game: GameId, dex: DexId): Promise<number[]> {
  const response = await send(`/api/progress/${game}/${dex}`)
  const body: { caught?: number[] } = await response.json()
  return body.caught ?? []
}

/** Replaces the server's list wholesale. The server sorts and de-duplicates. */
export async function putProgress(
  game: GameId,
  dex: DexId,
  caught: number[],
  /** Lets the request outlive the page, for the flush as the tab closes. */
  keepalive = false,
): Promise<void> {
  await send(`/api/progress/${game}/${dex}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ caught }),
    keepalive,
  })
}

/**
 * Wakes the free Render instance, and the database with it — the health check
 * includes the datasource, and Neon scales to zero too. Fired while the user is
 * still browsing, so the cold start is spent before anyone clicks Log in rather
 * than after.
 *
 * Actuator sits at the server root; the dev proxy and the Vercel rewrite both
 * map this one path onto it, so that `/api` stays the app's only prefix.
 *
 * Never rejects. An app that works offline is not in an error state when it is.
 */
export async function wake(): Promise<void> {
  try {
    await send('/api/actuator/health')
  } catch {
    // Offline, or the host is down. Neither is worth interrupting anyone for:
    // the dex works without a server, and login explains itself if it fails.
  }
}
