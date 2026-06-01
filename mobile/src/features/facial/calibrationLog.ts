/**
 * Log circular em memória para a tela de calibração.
 * Não persiste — apenas observa o hot path.
 */

export interface CalibrationEvent {
  ts: number;
  durationMs: number;
  topK: { employee_id: string; similarity: number; name?: string }[];
  decision: 'ACCEPT' | 'REJECT_THRESHOLD' | 'REJECT_GAP' | 'REJECT_SPOOF' | 'NO_FACE' | 'ERROR';
  threshold: number;
  gap?: number;
  faceSizeRatio?: number;
  reason?: string;
}

const MAX = 50;
const buffer: CalibrationEvent[] = [];
const listeners = new Set<(e: CalibrationEvent) => void>();
let enabled = false;

export const CalibrationLog = {
  setEnabled(v: boolean) {
    enabled = v;
  },

  isEnabled() {
    return enabled;
  },

  push(e: CalibrationEvent) {
    buffer.unshift(e);
    if (buffer.length > MAX) buffer.length = MAX;
    listeners.forEach(l => {
      try {
        l(e);
      } catch {
        // ignore
      }
    });
  },

  list(): CalibrationEvent[] {
    return buffer.slice();
  },

  clear() {
    buffer.length = 0;
  },

  subscribe(l: (e: CalibrationEvent) => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
