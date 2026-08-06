import { useState, useEffect, useRef, useCallback } from 'react';
import { getSaoPauloDateTime } from '../utils/time';
import { kioskLog } from '../services/kioskLogger';

/**
 * Janela de operação do kiosk. Fora dela o tablet entra em repouso (câmera
 * parada, tela apagada) para poupar bateria/desgaste — a maioria das escolas
 * registra entrada ~7h e saída ~18h, então de 19h às 6h ninguém usa o kiosk.
 *
 * Editar aqui ajusta o horário globalmente para todos os kiosks.
 */
export const KIOSK_ACTIVE_START_HOUR = 6;
export const KIOSK_ACTIVE_END_HOUR = 19;

/** Toque na tela durante o repouso acorda o kiosk por este tanto de tempo sem nova atividade. */
export const SLEEP_IDLE_TIMEOUT_MS = 3 * 60 * 1000;

const SCHEDULE_CHECK_INTERVAL_MS = 60 * 1000;
const MORNING_WAKE_KEY = '@kiosk:morning_wake_date';

function isScheduledActive(date: Date): boolean {
  const h = date.getHours();
  return h >= KIOSK_ACTIVE_START_HOUR && h < KIOSK_ACTIVE_END_HOUR;
}

export interface UseKioskSleepOptions {
  /** Chamado uma vez por dia, ao cruzar a hora de início da janela ativa (warm-up do cache). */
  onMorningWake?: () => void;
}

export interface UseKioskSleepResult {
  /** true quando o kiosk deve estar em repouso (sem câmera, sem wake lock). */
  asleep: boolean;
  /** Chamar em qualquer interação do usuário (toque na tela de repouso, captura, registro). */
  wake: (reason?: string) => void;
}

export function useKioskSleep({ onMorningWake }: UseKioskSleepOptions = {}): UseKioskSleepResult {
  const [asleep, setAsleep] = useState(() => !isScheduledActive(getSaoPauloDateTime()));

  // Timestamp até quando um toque fora do horário mantém o kiosk acordado manualmente.
  const manualAwakeUntilRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMorningWakeRef = useRef(onMorningWake);
  onMorningWakeRef.current = onMorningWake;

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const applyEffectiveState = useCallback((reason: string) => {
    const scheduledActive = isScheduledActive(getSaoPauloDateTime());
    const manualOverride = Date.now() < manualAwakeUntilRef.current;
    const nextAsleep = !scheduledActive && !manualOverride;
    setAsleep(prev => {
      if (prev !== nextAsleep) {
        kioskLog(nextAsleep ? 'KIOSK_SLEEP_ENTER' : 'KIOSK_SLEEP_WAKE', reason);
      }
      return nextAsleep;
    });
  }, []);

  /** Chamar em qualquer interação do usuário — acorda na hora e adia o re-repouso. */
  const wake = useCallback((reason: string = 'touch') => {
    manualAwakeUntilRef.current = Date.now() + SLEEP_IDLE_TIMEOUT_MS;
    clearIdleTimer();
    applyEffectiveState(reason);
    idleTimerRef.current = setTimeout(() => applyEffectiveState('idle-timeout'), SLEEP_IDLE_TIMEOUT_MS + 500);
  }, [applyEffectiveState]);

  // Checagem periódica da agenda — cobre tanto a transição natural (6h/19h)
  // quanto o fim de uma janela de repouso não coberta por wake().
  useEffect(() => {
    const check = () => {
      const now = getSaoPauloDateTime();
      applyEffectiveState('schedule');

      if (isScheduledActive(now) && now.getHours() === KIOSK_ACTIVE_START_HOUR) {
        const todayKey = now.toDateString();
        if (localStorage.getItem(MORNING_WAKE_KEY) !== todayKey) {
          localStorage.setItem(MORNING_WAKE_KEY, todayKey);
          onMorningWakeRef.current?.();
        }
      }
    };
    check();
    const id = setInterval(check, SCHEDULE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [applyEffectiveState]);

  useEffect(() => () => clearIdleTimer(), []);

  return { asleep, wake };
}
