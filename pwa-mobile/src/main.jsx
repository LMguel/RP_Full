import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Registrar service worker para PWA
if ('serviceWorker' in navigator) {
  // Captura antes do primeiro register: se já há controller, este é um reload normal.
  // Se não há, é a primeira instalação — não queremos recarregar nesse caso.
  const hadControllerOnBoot = !!navigator.serviceWorker.controller;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silent fail - PWA features optional
    });
  });

  // Quando um novo SW assume o controle (autoUpdate: skipWaiting chamado no SW),
  // kiosks recarregam automaticamente. O flag @kiosk:active garante retorno à câmera.
  // Outros dispositivos são tratados pelo SwUpdateToast (toast manual).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerOnBoot) return; // primeira instalação — não recarregar
    if (localStorage.getItem('@kiosk:active') === 'true') {
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
