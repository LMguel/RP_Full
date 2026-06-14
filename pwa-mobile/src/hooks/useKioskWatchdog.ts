import { useEffect, useRef } from 'react';

const RELOAD_AFTER_MS = 4 * 60 * 60 * 1000; // 4h — libera memória de sessões longas
const RETRY_DELAY_MS  = 5 * 60 * 1000;       // 5min — aguarda captura ativa terminar
const STORAGE_KEY     = '@kiosk:last_reload';

/**
 * Watchdog de reload periódico para o modo kiosk. Três camadas de segurança:
 *
 * 1. setTimeout  — caminho normal (JS ativo)
 * 2. visibilitychange — quando o browser suspende o JS por inatividade e
 *    a tela volta ao foco, verifica se o reload estava atrasado e o executa
 * 3. Web Worker  — timer em thread separada; envia mensagem ao main thread
 *    mesmo quando ele está sobrecarregado (mas não completamente travado)
 *
 * Se o main thread estiver completamente bloqueado (deadlock verdadeiro), nenhum
 * mecanismo JS consegue agir — nesse caso o próprio browser mata a aba por OOM.
 */
export function useKioskWatchdog({ isProcessing }: { isProcessing: boolean }) {
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  useEffect(() => {
    let mainTimer: ReturnType<typeof setTimeout>;
    let workerUrl: string | null = null;
    let worker: Worker | null = null;

    // ── helpers ──────────────────────────────────────────────────────────────────

    const shouldReloadNow = () =>
      Date.now() - parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10) >= RELOAD_AFTER_MS;

    const doReload = () => {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      window.location.reload();
    };

    const attemptReload = () => {
      if (isProcessingRef.current) {
        // Captura em andamento — aguarda e tenta de novo
        mainTimer = setTimeout(doReload, RETRY_DELAY_MS);
      } else {
        doReload();
      }
    };

    // ── 1. setTimeout (caminho principal) ────────────────────────────────────────

    const scheduleMain = () => {
      const lastReload = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
      const delay = Math.max(lastReload + RELOAD_AFTER_MS - Date.now(), 60_000);
      mainTimer = setTimeout(attemptReload, delay);
    };

    scheduleMain();

    // ── 2. visibilitychange (fallback para JS suspenso pelo browser) ─────────────
    // Cobre: tela bloqueada, tab em background, economia de energia do dispositivo.

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (shouldReloadNow()) {
        clearTimeout(mainTimer);
        attemptReload();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    // ── 3. Web Worker (fallback para main thread sobrecarregado) ─────────────────
    // Worker roda em thread separada; não é afetado por CPU intenso no main thread.
    // Quando o Worker avisa que está na hora, o main thread executa o reload.

    try {
      const code = `
        const RELOAD_AFTER = ${RELOAD_AFTER_MS};
        const STORAGE_KEY  = '${STORAGE_KEY}';
        let t;
        function go(lastReload) {
          clearTimeout(t);
          const delay = Math.max(lastReload + RELOAD_AFTER - Date.now(), 60000);
          t = setTimeout(() => self.postMessage('reload'), delay);
        }
        self.onmessage = (e) => {
          if (e.data.type === 'init') go(e.data.lastReload);
        };
      `;
      workerUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      worker    = new Worker(workerUrl);

      worker.onmessage = () => attemptReload();

      const lastReload = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
      worker.postMessage({ type: 'init', lastReload });
    } catch {
      // Web Workers não disponíveis (Safari privado, etc.) — apenas os outros mecanismos atuam
    }

    // ── cleanup ──────────────────────────────────────────────────────────────────

    return () => {
      clearTimeout(mainTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      worker?.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // roda apenas no mount — o reload re-inicializa o effect
}
