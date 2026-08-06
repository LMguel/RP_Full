import { useEffect } from 'react';

/**
 * Solicita o Screen Wake Lock para impedir que o display durma durante o kiosk.
 * Re-adquire automaticamente quando a aba volta a ficar visível (o sistema pode
 * liberar o lock ao minimizar ou ao travar a tela).
 *
 * `enabled=false` libera o lock e deixa o display dormir normalmente — usado no
 * modo repouso do kiosk (fora do horário de expediente) para poupar tela/bateria.
 */
export function useWakeLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch { /* permissão negada ou não suportado pelo dispositivo */ }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}
