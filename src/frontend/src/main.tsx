import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted so the page makes no third-party font request and the type never
// shifts. Only the weights actually used are imported.
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/silkscreen/400.css'

import './styles/tokens.css'
import './styles/global.css'
import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
