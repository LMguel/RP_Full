/**
 * Contexto global de correções — mantém o total de pendências disponível para
 * Layout (badge), DashboardPage (card + modal) e CorrecaoPage (dados completos).
 *
 * Não faz chamadas de API por si mesmo; é populado pela página que carregar os
 * dados primeiro (Dashboard ou Correções).
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { ResumoCorreções } from '../services/correctionsService';

interface CorrecoesContextValue {
  totalPendencias: number;
  resumo: ResumoCorreções | null;
  /** Chamado por qualquer página após rodar detectarPendencias() */
  setCorrecoesData: (total: number, resumo: ResumoCorreções) => void;
  /** Limpa após o usuário abrir a página de Correções */
  clearModalDismissed: () => void;
  modalDismissed: boolean;
  setModalDismissed: (v: boolean) => void;
}

const CorrecoesCtx = createContext<CorrecoesContextValue>({} as CorrecoesContextValue);

export function CorrecoesProvider({ children }: { children: ReactNode }) {
  const [totalPendencias, setTotal]   = useState(0);
  const [resumo, setResumo]           = useState<ResumoCorreções | null>(null);
  const [modalDismissed, setModalDismissed] = useState(false);

  const setCorrecoesData = useCallback((total: number, r: ResumoCorreções) => {
    setTotal(total);
    setResumo(r);
  }, []);

  const clearModalDismissed = useCallback(() => setModalDismissed(false), []);

  return (
    <CorrecoesCtx.Provider value={{
      totalPendencias,
      resumo,
      setCorrecoesData,
      modalDismissed,
      setModalDismissed,
      clearModalDismissed,
    }}>
      {children}
    </CorrecoesCtx.Provider>
  );
}

export function useCorrecoesCtx() {
  return useContext(CorrecoesCtx);
}
