import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export async function pingBackend(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Cache-bust with timestamp: Workbox NetworkFirst caches /api/* responses, so a static
    // URL returns a cached 200 even when the backend is down. Unique URL = no cache hit =
    // real network request = fails immediately on ERR_CONNECTION_REFUSED.
    // Include stored token so the backend returns 200 instead of 401 (cleaner server logs).
    const token = localStorage.getItem('@app:token');
    await fetch(`${API_URL}/api/funcionarios?_p=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export function useBackendStatus(intervalMs = 12000): boolean {
  const [available, setAvailable] = useState(true); // optimistic

  const check = useCallback(async () => {
    const ok = await pingBackend();
    setAvailable(prev => {
      if (prev !== ok) {
        if (!ok) {
          console.warn('[PWA Kiosk] Backend inacessível — modo contingência ativo');
        } else {
          console.log('[PWA Kiosk] Backend restaurado');
        }
      }
      return ok;
    });
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  useEffect(() => {
    const onOnline = () => { console.log('[PWA] Rede reconectada, verificando backend...'); check(); };
    const onOffline = () => { console.warn('[PWA] Rede offline'); setAvailable(false); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [check]);

  return available;
}
