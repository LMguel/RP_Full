import { useEffect, useRef, useCallback } from 'react';
import type { UserType } from '../types';

// Timeouts por tipo de usuário — rolam (não são absolutos) enquanto houver
// atividade: renewSession() é chamado a cada request bem-sucedida (ver
// interceptor de resposta em services/api.ts), então na prática só expira
// depois desse tempo SEM nenhum uso do app.
export const SESSION_TIMEOUT_MS: Record<string, number> = {
  empresa:     12 * 60 * 60 * 1000,  // 12 horas
  funcionario:  8 * 60 * 60 * 1000,  // 8 horas
};

const STORAGE_KEY = '@app:session_expires';

export function useSessionTimeout(userType: UserType | null, onExpire: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Roda quando o timer local zera. Sem internet não há como saber se o token
  // realmente expirou no backend — expirar mesmo assim derruba kiosks que
  // ficaram 24/7 sem nenhuma requisição bem-sucedida por >timeout (ex.: queda
  // de luz/internet prolongada). Nesse caso só estende o timer local; a decisão
  // de verdade acontece quando a conexão voltar (próximo request bem-sucedido
  // chama renewSession, ou o refresh periódico do JWT no kiosk).
  const scheduleExpiry = useCallback((expiresAt: number, timeout: number) => {
    clearTimer();
    const remaining = expiresAt - Date.now();

    const fire = () => {
      if (!navigator.onLine) {
        const newExpiresAt = Date.now() + timeout;
        localStorage.setItem(STORAGE_KEY, String(newExpiresAt));
        scheduleExpiry(newExpiresAt, timeout);
        return;
      }
      onExpireRef.current();
    };

    if (remaining <= 0) {
      fire();
      return;
    }
    // setTimeout tem limite de ~24.8 dias; clampar para segurança
    const delay = Math.min(remaining, 2_147_483_647);
    timerRef.current = setTimeout(fire, delay);
  }, [clearTimer]);

  useEffect(() => {
    if (!userType) {
      clearTimer();
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const timeout = SESSION_TIMEOUT_MS[userType];
    if (!timeout) return;

    // Verificar se já existe uma sessão salva
    const stored = localStorage.getItem(STORAGE_KEY);
    let expiresAt: number;

    if (stored) {
      expiresAt = parseInt(stored, 10);
      if (isNaN(expiresAt)) {
        expiresAt = Date.now() + timeout;
        localStorage.setItem(STORAGE_KEY, String(expiresAt));
      }
    } else {
      expiresAt = Date.now() + timeout;
      localStorage.setItem(STORAGE_KEY, String(expiresAt));
    }

    scheduleExpiry(expiresAt, timeout);
    return clearTimer;
  }, [userType, scheduleExpiry, clearTimer]);
}

/** Redefine o timer de sessão (chamar em ações do usuário para evitar logout durante uso ativo). */
export function renewSession(userType: UserType | null): void {
  if (!userType) return;
  const timeout = SESSION_TIMEOUT_MS[userType];
  if (!timeout) return;
  localStorage.setItem(STORAGE_KEY, String(Date.now() + timeout));
}
