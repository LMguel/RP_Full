import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './utils/pwaUtils'

// Registrar Service Worker para PWA
if (import.meta.env.PROD || import.meta.env.DEV) {
  registerServiceWorker().catch(err => {
    console.error('Erro ao registrar Service Worker:', err);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
