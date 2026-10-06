import { useState, useEffect } from 'react';

/**
 * Histerese do modo offline do kiosk.
 *
 * Entra no modo offline imediatamente quando a rede/backend cai, mas só sai
 * depois de `exitDelayMs` de conexão contínua. Sem isso, um Wi-Fi oscilando
 * (cai/volta a cada 1–3 min) fazia a tela alternar entre câmera e lista offline,
 * zerando o fluxo de quem estava no meio de um registro.
 */
export function useStableOffline(rawOffline: boolean, exitDelayMs = 60_000): boolean {
  const [stableOffline, setStableOffline] = useState(rawOffline);

  useEffect(() => {
    if (rawOffline) {
      setStableOffline(true);
      return;
    }
    if (!stableOffline) return;
    const t = setTimeout(() => setStableOffline(false), exitDelayMs);
    return () => clearTimeout(t);
  }, [rawOffline, stableOffline, exitDelayMs]);

  return stableOffline;
}
