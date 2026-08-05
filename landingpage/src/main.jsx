import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import './main.css'

const rootEl = document.getElementById('root')
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if (import.meta.env.PROD && rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, app)
} else {
  createRoot(rootEl).render(app)
}
