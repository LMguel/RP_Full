import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function applyUpdate(reg: ServiceWorkerRegistration) {
  if (!reg.waiting) {
    window.location.reload();
    return;
  }
  // Garante que o flag de kiosk sobreviva ao reload
  if (localStorage.getItem('@kiosk:active') === 'true') {
    localStorage.setItem('@kiosk:active', 'true');
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  }, { once: true });
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Detecta nova versão do Service Worker e aplica a atualização.
 *
 * Kiosk (tablet de ponto): atualização silenciosa e automática após 5s.
 * Outros dispositivos: toast manual "Atualizar agora".
 *
 * O recarregamento preserva @kiosk:active, então o tablet retorna à câmera
 * via KioskAutoReturn em App.tsx.
 */
export default function SwUpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleNewWorker = (reg: ServiceWorkerRegistration, newWorker: ServiceWorker) => {
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state !== 'installed' || !navigator.serviceWorker.controller) return;

        const isKiosk = localStorage.getItem('@kiosk:active') === 'true';
        if (isKiosk) {
          // Aplica automaticamente após 5s — tempo suficiente para terminar
          // qualquer captura facial em andamento antes de recarregar
          setTimeout(() => applyUpdate(reg), 5_000);
        } else {
          setRegistration(reg);
          setShowUpdate(true);
        }
      });
    };

    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) handleNewWorker(reg, newWorker);
      });

      // SW já aguardando quando a página carregou (ex: após reload com update pendente)
      if (reg.waiting && navigator.serviceWorker.controller) {
        const isKiosk = localStorage.getItem('@kiosk:active') === 'true';
        if (isKiosk) {
          setTimeout(() => applyUpdate(reg), 2_000);
        } else {
          setRegistration(reg);
          setShowUpdate(true);
        }
      }
    }).catch(() => {});
  }, []);

  const handleUpdate = () => {
    if (registration) applyUpdate(registration);
    else window.location.reload();
    setShowUpdate(false);
  };

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-slate-800 border border-slate-600 rounded-2xl px-4 py-3 shadow-2xl text-sm"
        >
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          <span className="text-slate-200 font-medium">Nova atualização disponível</span>
          <button
            onClick={handleUpdate}
            className="ml-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
          >
            Atualizar agora
          </button>
          <button
            onClick={() => setShowUpdate(false)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Fechar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
