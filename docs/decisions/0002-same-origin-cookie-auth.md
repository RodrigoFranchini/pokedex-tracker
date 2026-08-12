# 0002 — Same-origin API, JWT in an httpOnly cookie

**Status:** Accepted
**Date:** 2026-08

## Context

The app needed sign-in so an account could carry progress between devices. The
front end and back end are deployed separately — a static bundle on one host, a
Java service on another — which normally means a cross-origin API, CORS, and a
token the browser has to be told how to store.

The usual answer is a bearer token in `localStorage`, sent in an
`Authorization` header. It is simple to build and readable by any script on the
page, which makes an XSS bug a total account compromise.

## Decision

**The API is same-origin, always, and the token is a cookie JavaScript cannot
read.**

- **The front end fetches relative paths only.** Every path starts with `/api`.
  There is no base URL, no `VITE_` variable for one, and **no CORS
  configuration anywhere.** A Vite proxy provides this in development; a Vercel
  rewrite will provide it in production.
- **Auth is a JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie** named
  `token`, path `/`, seven days. `AuthCookieFactory` is the only thing that
  builds it, so register, login and logout cannot disagree about its flags.
- **`credentials: 'include'` is set in exactly one place**, in `lib/api.ts`.
  `fetch` omits cookies by default, so without it every authenticated call is a
  401 and nothing says why.
- **The token carries the user id and nothing else.** A JWT is signed, not
  encrypted; anyone holding it can read the payload. The filter loads the user
  from the database rather than trusting the token's contents, so deleting a
  user takes effect immediately instead of at expiry.
- **CSRF protection is disabled.** The defence is `SameSite=Lax` plus the API
  being same-origin with the app.

## Alternatives considered

- **Bearer token in `localStorage`.** Rejected: readable by any script, so one
  XSS is full account takeover. The cookie approach removes that class of bug
  entirely.
- **Cross-origin API with CORS and `SameSite=None`.** Rejected: a third-party
  cookie in every browser's eyes, which is a category actively being removed. It
  also means CORS configuration in two places and a base URL to keep in step.

## Consequences

**What it buys**

- JavaScript cannot leak the token, because JavaScript cannot see it.
- No CORS anywhere, no preflight requests, no base URL to configure per
  environment.
- The cookie is first-party, so no browser privacy change threatens it.

**What it costs**

- **Same-origin is now load-bearing, not a convenience.** Introducing an API
  base URL breaks the auth design, not just the configuration. This is the
  single most important thing to know before changing how the front end reaches
  the server.
- **Disabling CSRF is only safe while `SameSite=Lax` and same-origin both
  hold.** Break either and the protection is gone with nothing in its place.
- Signing in costs a round trip to ask *who am I* on load, since the app cannot
  read the cookie to find out.
- A `Secure` cookie is dropped by any origin the browser does not consider
  secure, which broke local development in Safari and on a phone over the LAN.
  See [0008](0008-dev-proxy-strips-secure.md).
- Health lives at `/actuator/health`, outside `/api`. The proxy and the rewrite
  each map that one path specially so `/api` stays the only prefix; getting it
  wrong makes the warm-up ping answer 401 and wake nothing.
