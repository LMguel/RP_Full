import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Detecta nova versão do Service Worker e oferece atualização controlada.
 * Não recarrega automaticamente para não interromper o kiosk.
 */
export default function SwUpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdateFound = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nova versão pronta mas aguardando — informar o usuário
          setRegistration(reg);
          setShowUpdate(true);
        }
      });
    };

    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => handleUpdateFound(reg));
      // Checar se já há um worker esperando (ex: após reload)
      if (reg.waiting && navigator.serviceWorker.controller) {
        setRegistration(reg);
        setShowUpdate(true);
      }
    }).catch(() => {});
  }, []);

  const handleUpdate = () => {
    if (!registration?.waiting) {
      // SW já ativo — apenas recarregar
      window.location.reload();
      return;
    }
    const kioskWasActive = localStorage.getItem('@kiosk:active') === 'true';
    // Listener: quando novo SW tomar controle, recarregar a página
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (kioskWasActive) {
        // kiosk flag já está setado — ao recarregar, AuthContext irá redirecionar
        localStorage.setItem('@kiosk:active', 'true');
      }
      window.location.reload();
    }, { once: true });
    // Ativar novo SW
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
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
