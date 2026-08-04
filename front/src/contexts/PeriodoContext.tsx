/**
 * Contexto global de período (mês/ano) — compartilhado entre as páginas de
 * Registros (Espelho de Ponto, Registros Diários, Registros Gerais) e
 * Correções, para que o mês selecionado não seja perdido ao trocar de aba.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

interface PeriodoContextValue {
  ano: number;
  mes: number; // 1-12
  /** Define o período diretamente por ano/mês (normaliza mes fora de 1-12). */
  setPeriodo: (ano: number, mes: number) => void;
  avancarMes: () => void;
  voltarMes: () => void;
  /** Primeiro dia do mês selecionado, formato YYYY-MM-DD. */
  dataInicio: string;
  /** Último dia do mês selecionado, formato YYYY-MM-DD. */
  dataFim: string;
  /** Mês selecionado no formato YYYY-MM (compatível com <input type="month">). */
  mesAno: string;
}

const PeriodoCtx = createContext<PeriodoContextValue>({} as PeriodoContextValue);

function primeiroDia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

function ultimoDia(ano: number, mes: number): string {
  const dia = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function normalizar(ano: number, mes: number): { ano: number; mes: number } {
  let a = ano, m = mes;
  while (m < 1) { m += 12; a -= 1; }
  while (m > 12) { m -= 12; a += 1; }
  return { ano: a, mes: m };
}

export function PeriodoProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [{ ano, mes }, setState] = useState(() => normalizar(now.getFullYear(), now.getMonth() + 1));

  const setPeriodo = useCallback((a: number, m: number) => {
    setState(normalizar(a, m));
  }, []);

  const avancarMes = useCallback(() => {
    setState(prev => normalizar(prev.ano, prev.mes + 1));
  }, []);

  const voltarMes = useCallback(() => {
    setState(prev => normalizar(prev.ano, prev.mes - 1));
  }, []);

  const dataInicio = useMemo(() => primeiroDia(ano, mes), [ano, mes]);
  const dataFim     = useMemo(() => ultimoDia(ano, mes), [ano, mes]);
  const mesAno       = useMemo(() => `${ano}-${String(mes).padStart(2, '0')}`, [ano, mes]);

  const value = useMemo(
    () => ({ ano, mes, setPeriodo, avancarMes, voltarMes, dataInicio, dataFim, mesAno }),
    [ano, mes, setPeriodo, avancarMes, voltarMes, dataInicio, dataFim, mesAno],
  );

  return <PeriodoCtx.Provider value={value}>{children}</PeriodoCtx.Provider>;
}

export function usePeriodo() {
  return useContext(PeriodoCtx);
}
