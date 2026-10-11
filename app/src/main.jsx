import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initTvEnv } from './api/luna.js'
import { initSession } from './store/session.js'
import './styles/index.css'

// Wait for the transport environment before the first frame. Resolves instantly
// in the browser; on the real device this pings the Luna service.
await initTvEnv()
// Decrypt the saved session so the first requests already carry the token.
await initSession()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
