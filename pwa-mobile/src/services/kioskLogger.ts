const STORAGE_KEY = '@kiosk:logs';
const MAX_ENTRIES = 200;

export type KioskEvent =
  | 'KIOSK_BOOT'
  | 'UPDATE_START'
  | 'UPDATE_SUCCESS'
  | 'UPDATE_FAIL'
  | 'CAMERA_START'
  | 'CAMERA_STOP'
  | 'CAMERA_RESTART'
  | 'CACHE_RESTORE'
  | 'OFFLINE_QUEUE_RESUME'
  | 'FACIAL_RESTART'
  | 'RECOVERY_CAMERA'
  | 'RECOVERY_RELOAD';

export interface KioskLogEntry {
  ts: number;
  event: KioskEvent;
  detail?: string;
}

export function kioskLog(event: KioskEvent, detail?: string): void {
  try {
    const entries = getKioskLogs();
    entries.push({ ts: Date.now(), event, detail });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch { /* localStorage indisponível ou cheio */ }
}

export function getKioskLogs(): KioskLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KioskLogEntry[]) : [];
  } catch {
    return [];
  }
}
