import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { kioskLog } from '../services/kioskLogger';
import { kioskUpdateCoordinator } from '../services/kioskUpdateCoordinator';

const ANTI_LOOP_KEY = '@kiosk:last_update_attempt';
const UPDATE_PENDING_KEY = '@kiosk:update_pending';
const ANTI_LOOP_MS = 120_000; // mínimo 2min entre tentativas
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // verifica a cada 30min

function applyUpdate(reg: ServiceWorkerRegistration) {
  let reloaded = false;
  const doReload = () => {
    if (!reloaded) { reloaded = true; window.location.reload(); }
  };
  navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Fallback: FKB pode não disparar controllerchange — força reload após 10s
    setTimeout(doReload, 10_000);
  } else {
    doReload();
  }
}

function isAntiLoopOk(): boolean {
  const last = parseInt(localStorage.getItem(ANTI_LOOP_KEY) ?? '0', 10);
  return Date.now() - last >= ANTI_LOOP_MS;
}

/**
 * Gerencia atualizações do Service Worker.
 *
 * Kiosk:     fullscreen "ATUALIZANDO SISTEMA" → para câmera → reload automático.
 * Não-kiosk: modal central — usuário confirma antes de continuar.
 *
 * Polling: verifica update a cada 30min e ao retornar ao foco/visibilidade
 * (garante que tablets 24/7 no Fully Kiosk Browser recebam updates sem reload manual).
 *
 * Anti-loop: mínimo 120s entre tentativas.
 */
export default function SwUpdateToast() {
  const [showModal, setShowModal] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showKioskUpdate, setShowKioskUpdate] = useState(false);
  // Armazena cleanup das assinaturas criadas dentro do .then() assíncrono
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const startKioskUpdate = (reg: ServiceWorkerRegistration) => {
      if (!isAntiLoopOk()) {
        console.log('[SwUpdate] Anti-loop: skipping — última tentativa < 120s atrás');
        return;
      }
      localStorage.setItem(ANTI_LOOP_KEY, String(Date.now()));
      localStorage.setItem(UPDATE_PENDING_KEY, 'true');
      kioskLog('UPDATE_START', 'SW waiting detectado');
      setShowKioskUpdate(true);

      kioskUpdateCoordinator.setUpdateReady(() => {
        try {
          applyUpdate(reg);
          kioskLog('UPDATE_SUCCESS');
        } catch (e) {
          kioskLog('UPDATE_FAIL', String(e));
          localStorage.removeItem(UPDATE_PENDING_KEY);
          setShowKioskUpdate(false);
        }
      });
    };

    const onNewWorker = (reg: ServiceWorkerRegistration, worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
        if (localStorage.getItem('@kiosk:active') === 'true') {
          startKioskUpdate(reg);
        } else {
          setRegistration(reg);
          setShowModal(true);
        }
      });
    };

    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) onNewWorker(reg, w);
      });

      // SW já aguardando quando a página carregou (tab reaberta com update pendente)
      if (reg.waiting && navigator.serviceWorker.controller) {
        if (localStorage.getItem('@kiosk:active') === 'true') {
          startKioskUpdate(reg);
        } else {
          setRegistration(reg);
          setShowModal(true);
        }
      }

      // ── Polling de updates ────────────────────────────────────────────────────
      // Tablets 24/7 no Fully Kiosk Browser nunca recarregam a página, então o SW
      // nunca detecta novos builds automaticamente. Forçar reg.update() periodicamente
      // faz o SW re-buscar seu script no S3 e acionar updatefound se houver mudança.

      const doCheck = () => reg.update().catch(() => {});

      // A cada 30 minutos
      const checkInterval = setInterval(doCheck, UPDATE_CHECK_INTERVAL_MS);

      // Ao retornar ao foco ou visibilidade (FKB traz app para primeiro plano)
      const onVisibilityOrFocus = () => {
        if (document.visibilityState === 'visible') doCheck();
      };
      document.addEventListener('visibilitychange', onVisibilityOrFocus);
      window.addEventListener('focus', onVisibilityOrFocus);

      cleanupRef.current = () => {
        clearInterval(checkInterval);
        document.removeEventListener('visibilitychange', onVisibilityOrFocus);
        window.removeEventListener('focus', onVisibilityOrFocus);
      };
    }).catch(() => {});

    return () => { cleanupRef.current?.(); };
  }, []);

  const handleUpdate = () => {
    if (registration) applyUpdate(registration);
    else window.location.reload();
  };

  return (
    <>
      {/* Não-kiosk: modal central bloqueante */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-md"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-8 px-8 py-10 w-full max-w-[340px] mx-4 bg-slate-900 rounded-3xl border border-slate-700/40 shadow-2xl"
            >
              <div className="w-20 h-20 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                <svg
                  className="w-9 h-9 text-blue-400 animate-spin"
                  style={{ animationDuration: '2s' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Atualização disponível
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Uma nova versão do REGISTRA.PONTO precisa ser aplicada.
                </p>
              </div>
              <button
                onClick={handleUpdate}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-sm tracking-widest uppercase transition-all shadow-lg shadow-blue-900/30"
              >
                ATUALIZAR AGORA
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kiosk: fullscreen "ATUALIZANDO SISTEMA" — sem botão, automático */}
      <AnimatePresence>
        {showKioskUpdate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950"
          >
            <div className="flex flex-col items-center gap-8 text-center px-8">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-blue-600/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
                <div className="absolute inset-3 rounded-full bg-blue-600/10 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                  Atualizando sistema
                </h2>
                <p className="text-slate-400 text-base">Aguarde alguns segundos</p>
              </div>

              <div className="flex gap-2 items-center">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
