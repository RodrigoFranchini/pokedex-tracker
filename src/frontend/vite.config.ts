import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Only the dev server ever sees this URL -- the app fetches relative paths, so
// it never reaches the bundle. In production Vercel's rewrite does this job.
const API_TARGET = 'https://pokedex-tracker-awo1.onrender.com'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    /*
     * Signing in needs a secure origin. The cookie is `Secure`, and a browser
     * drops a `Secure` cookie from any origin it does not consider secure —
     * `localhost` qualifies, `http://192.168.x.x` does not — so the app can be
     * opened on a phone over the LAN but never signed in on one. A tunnel gives
     * the phone a real https address, and Vite refuses hostnames it does not
     * know, which is what this is for.
     *
     * Named rather than `true`: that would turn off the DNS-rebinding guard for
     * every host, on a dev server that proxies to a live authenticated API.
     * Another tunnel means another entry here, not opening it up.
     */
    allowedHosts: ['.trycloudflare.com'],
    // Same-origin in development, the way the Vercel rewrite is in production.
    // That is what makes the auth cookie first-party and CORS unnecessary.
    proxy: {
      '/api': {
        target: API_TARGET,
        // Render routes by Host header; without this it is sent localhost:5173.
        changeOrigin: true,
        // Actuator sits at the server root, not under /api. Rewriting the one
        // path keeps /api as the app's only origin-relative prefix.
        rewrite: (path) => path.replace(/^\/api\/actuator\//, '/actuator/'),
        configure: (proxy) => {
          /*
           * The deployed server sets COOKIE_SECURE=true, which is right for the
           * origin it is deployed on and wrong for the one this serves: a
           * `Secure` cookie arriving over plain http is dropped, and the app
           * then believes it is signed in while every request goes out
           * anonymous.
           *
           * Chrome and Firefox make an exception for localhost. WebKit does
           * not, so in Safari the cookie was never kept at all -- which is why
           * signing in appeared to do nothing and no progress ever reached an
           * account. Nor is there an exception anywhere for the LAN address the
           * app gets opened on from a phone.
           *
           * So the proxy corrects the flag for the origin it is actually
           * serving, the same way it already corrects the Host header and the
           * actuator path. Nothing here reaches the bundle: in production the
           * page is https and the cookie keeps the flag it was sent with.
           *
           * The trade is that a real session cookie now travels in clear text
           * on the LAN. That is a development server pointed at a live API --
           * sign in on it with an account you would not mind losing.
           */
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie']
            if (!cookies) return
            proxyRes.headers['set-cookie'] = cookies.map((cookie) =>
              cookie.replace(/;\s*Secure\b/gi, ''),
            )
          })
        },
      },
    },
  },
})
