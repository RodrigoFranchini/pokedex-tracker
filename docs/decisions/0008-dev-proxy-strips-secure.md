# 0008 — The dev proxy strips `Secure` from proxied cookies

**Status:** Accepted
**Date:** 2026-08

## Context

The auth cookie is `Secure` ([0002](0002-same-origin-cookie-auth.md)), which is
correct for the origin the back end is deployed on. The deployed service sets
`COOKIE_SECURE=true`.

Development runs the Vite dev server over plain HTTP at
`http://localhost:5173`, proxying `/api` to that deployed back end. So the
browser receives a `Secure` cookie over a non-secure origin.

Browsers disagree about what to do with that:

- **Chrome and Firefox** make an exception for `localhost` and store it.
- **WebKit — Safari — does not.** It discards the cookie silently.
- **No browser** makes an exception for a LAN address like
  `http://192.168.1.x:5173`, which is how the app gets opened on a phone.

The result in Safari: login returns 200, the cookie is dropped, and every
subsequent request goes out anonymous. This produced two bugs that looked
unrelated — progress never reaching an account, and later, sign-in appearing not
to take effect at all — and it hid from investigation because the debugging was
done in a Chromium-based browser where the session worked.

## Decision

**The Vite dev proxy rewrites `Set-Cookie` on the way through, removing the
`Secure` attribute.** `HttpOnly` and `SameSite=Lax` are preserved.

This lives in `src/frontend/vite.config.ts`, alongside the two corrections the
proxy already makes: rewriting the `Host` header, and mapping the actuator path.
Correcting the cookie for the origin it is actually serving is the same job.

**Nothing about production changes.** The rewrite exists only in the dev server,
which never ships. In production the page is HTTPS and the cookie keeps the flag
it was sent with.

## Alternatives considered

- **Run the back end locally with `COOKIE_SECURE=false`.** Works, and is still
  supported by pointing `API_TARGET` at `localhost:8080`. Rejected as the
  default because it requires JDK 21 and Docker to do front-end work, and does
  not let you test against real deployed behaviour.
- **Serve the dev server over HTTPS with a local certificate.** Solves it
  properly for every browser, at the cost of certificate setup on each machine
  and a trust prompt on each device.
- **A tunnel giving the dev server a real HTTPS address.** Already supported —
  `allowedHosts` permits `.trycloudflare.com`. Good for testing on a real phone;
  too much ceremony for everyday work.

## Consequences

**What it buys**

- Sign-in works in development in every browser, Safari included.
- Sign-in works from a phone on the LAN with no tunnel, which is the fastest way
  to test the mobile layout against a real session.
- The failure it removes was silent and highly misleading, costing two rounds of
  investigation.

**What it costs**

- **A real session cookie travels in clear text on the local network.** This is
  a development server pointed at a live API: sign in on it with an account you
  would not mind losing. Do not use a personal account with real progress.
- Development is now one attribute away from production behaviour. A bug that
  depends specifically on `Secure` would not reproduce locally — the proxy
  config is the first place to look if one is suspected.

## Related

`AGENTS.md` records the general lesson: an auth or session bug verified only in
a Chromium-based browser is not verified. Reproduce in Safari, or check the
mechanism — what `Set-Cookie` actually contains at the origin serving the page.
