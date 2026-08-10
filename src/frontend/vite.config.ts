import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Only the dev server ever sees this URL -- the app fetches relative paths, so
// it never reaches the bundle. In production Vercel's rewrite does this job.
const API_TARGET = 'https://pokedex-tracker-awo1.onrender.com'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
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
      },
    },
  },
})
