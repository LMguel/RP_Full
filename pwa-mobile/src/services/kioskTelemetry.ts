/**
 * KioskTelemetryService — envia logs e heartbeat para o backend silenciosamente.
 *
 * Logs:  batch a cada FLUSH_INTERVAL_MS, envia apenas entradas novas
 *        (rastreia posição via localStorage @kiosk:logs_flush_ts).
 * Heartbeat: versão, uptime, bateria, wifi, tamanho da fila — a cada HEARTBEAT_INTERVAL_MS.
 *
 * Todas as chamadas são fire-and-forget: erros de rede não propagam.
 */

import { getKioskLogs } from './kioskLogger';

const API_URL = import.meta.env.VITE_API_URL as string;
const FLUSH_INTERVAL_MS   = 5 * 60 * 1000;  // 5 min
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const LAST_FLUSH_KEY = '@kiosk:logs_flush_ts';
const DEVICE_ID_KEY  = '@app:device_id';

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `pwa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getAuthHeader(): string | null {
  const token = localStorage.getItem('@app:token');
  return token ? `Bearer ${token}` : null;
}

async function getBatteryLevel(): Promise<number | undefined> {
  try {
    const battery = await (navigator as any).getBattery?.();
    if (battery?.level !== undefined) return Math.round(battery.level * 100);
  } catch { /* ignore */ }
  return undefined;
}

export class KioskTelemetryService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly startTimeMs = Date.now();

  /** `getPendingCount` deve ser uma ref/getter estável do componente pai. */
  start(getPendingCount: () => number): void {
    if (this.intervalId !== null) return;
    // Flush imediato ao iniciar (envia logs acumulados antes do boot)
    setTimeout(() => this.flush(getPendingCount), 10_000);
    this.intervalId = setInterval(() => this.flush(getPendingCount), FLUSH_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async flush(getPendingCount: () => number): Promise<void> {
    await Promise.all([
      this.sendLogs(),
      this.sendHeartbeat(getPendingCount),
    ]);
  }

  private async sendLogs(): Promise<void> {
    const auth = getAuthHeader();
    if (!auth) return;

    const allLogs = getKioskLogs();
    if (allLogs.length === 0) return;

    // Envia apenas entradas mais recentes que o último flush
    const lastFlushTs = parseInt(localStorage.getItem(LAST_FLUSH_KEY) || '0', 10);
    const newEntries = allLogs.filter(e => e.ts > lastFlushTs);
    if (newEntries.length === 0) return;

    try {
      const resp = await fetch(`${API_URL}/api/kiosk/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({
          device_id: getDeviceId(),
          version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
          entries: newEntries,
        }),
      });
      if (resp.ok) {
        // Marca timestamp do log mais recente enviado
        const maxTs = Math.max(...newEntries.map(e => e.ts));
        localStorage.setItem(LAST_FLUSH_KEY, String(maxTs));
      }
    } catch { /* rede indisponível — tenta no próximo ciclo */ }
  }

  private async sendHeartbeat(getPendingCount: () => number): Promise<void> {
    const auth = getAuthHeader();
    if (!auth) return;

    const battery = await getBatteryLevel();

    try {
      const resp = await fetch(`${API_URL}/api/kiosk/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({
          tablet_id: getDeviceId(),
          version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
          uptime: Date.now() - this.startTimeMs,
          battery,
          wifi: navigator.onLine,
          queue_size: getPendingCount(),
          last_sync: localStorage.getItem('@kiosk:last_sync') || null,
        }),
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (data.force_update) {
          // Admin pediu atualização forçada — verifica nova versão do SW silenciosamente
          navigator.serviceWorker?.getRegistration().then(reg => { reg?.update(); });
        }
      }
    } catch { /* fire-and-forget */ }
  }
}

export const kioskTelemetry = new KioskTelemetryService();
