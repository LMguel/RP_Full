/**
 * Serviço de detecção e classificação de pendências de ponto.
 * Lógica pura — sem chamadas de API.
 *
 * Regras principais:
 *   intervalo = 0  → esperado 2 registros (Entrada / Saída)
 *   intervalo > 0  → esperado 4 registros (Entrada / Saída Almoço / Volta Almoço / Saída)
 *   > 4 registros  → SEMPRE "registros_excedentes" (acima do fluxo suportado)
 *   dia atual      → EM_PROCESSAMENTO, nunca gera pendência
 */

import type { Employee, TimeRecord, WeekdayKey } from '../types';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TipoPendencia =
  | 'saida_nao_registrada'
  | 'intervalo_incompleto'
  | 'quantidade_incorreta'
  | 'sem_registros'
  | 'registros_excedentes';

export interface Pendencia {
  /** Chave única: `{funcionario_id}|{YYYY-MM-DD}` */
  key: string;
  funcionario_id: string;
  funcionario_nome: string;
  cargo: string;
  /** YYYY-MM-DD */
  data: string;
  /** DD/MM/YYYY */
  data_formatada: string;
  dia_semana: string;
  /** Registros ativos do dia, ordenados por data_hora */
  registros: TimeRecord[];
  tipo: TipoPendencia;
  descricao: string;
  esperado: number;
  encontrado: number;
  intervalo_padrao_minutos: number;
}

export interface ResumoCorreções {
  total: number;
  saida_nao_registrada: number;
  intervalo_incompleto: number;
  sem_registros: number;
  registros_excedentes: number;
  quantidade_incorreta: number;
  proximos: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIAS_PT: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
  4: 'Quinta', 5: 'Sexta', 6: 'Sábado',
};

const WEEKDAY_KEYS: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getTodayStr(): string {
  return toDateStr(new Date());
}

function parseLocalDate(dateStr: string): Date {
  // Evita problema de fuso: força meio-dia local
  return new Date(`${dateStr}T12:00:00`);
}

function isWorkingDay(date: Date, emp: Employee): boolean {
  const dayIndex = date.getDay();
  const key = WEEKDAY_KEYS[dayIndex];

  if (emp.custom_schedule && Object.keys(emp.custom_schedule).length > 0) {
    const cfg = emp.custom_schedule[key];
    if (!cfg) return false;
    return cfg.active !== false && Boolean(cfg.start);
  }

  // Sem schedule personalizado: considera Seg–Sex como dias úteis
  return dayIndex >= 1 && dayIndex <= 5;
}

/** Classifica a pendência com base nos tipos dos registros e no intervalo configurado. */
function classificarPendencia(
  records: TimeRecord[],
  intervalo: number,
): { tipo: TipoPendencia; descricao: string } {
  const n = records.length;

  if (n > 4) {
    return {
      tipo: 'registros_excedentes',
      descricao: `Quantidade acima do fluxo suportado (${n} registros encontrados, máximo 4)`,
    };
  }

  const tipos = records.map(r =>
    (r.tipo || (r as any).type || '').toLowerCase().trim(),
  );

  const hasEntrada      = tipos.some(t => t === 'entrada');
  const hasSaidaAlmoco  = tipos.some(t => t === 'saida_almoco');
  const hasRetornoAlmoc = tipos.some(t => t === 'retorno_almoco');
  const hasSaida        = tipos.some(t => t === 'saída' || t === 'saida');

  const esperado = intervalo > 0 ? 4 : 2;

  if (intervalo > 0) {
    // Fluxo: Entrada → Saída Almoço → Volta Almoço → Saída
    if (n === 3) {
      if (hasSaidaAlmoco && hasRetornoAlmoc && !hasSaida) {
        return { tipo: 'saida_nao_registrada', descricao: 'Saída final não registrada' };
      }
      if (hasSaidaAlmoco && !hasRetornoAlmoc) {
        return { tipo: 'intervalo_incompleto', descricao: 'Volta do intervalo não registrada' };
      }
      return { tipo: 'saida_nao_registrada', descricao: 'Saída final não registrada' };
    }
    if (n === 2) {
      if (hasSaidaAlmoco && !hasRetornoAlmoc) {
        return { tipo: 'intervalo_incompleto', descricao: 'Volta do intervalo e saída não registradas' };
      }
      return { tipo: 'quantidade_incorreta', descricao: `Esperado: ${esperado} registros, encontrado: ${n}` };
    }
    if (n === 1 && hasEntrada) {
      return { tipo: 'saida_nao_registrada', descricao: 'Apenas entrada registrada' };
    }
    return { tipo: 'quantidade_incorreta', descricao: `Esperado: ${esperado} registros, encontrado: ${n}` };
  } else {
    // Fluxo: Entrada → Saída
    if (n === 1 && hasEntrada) {
      return { tipo: 'saida_nao_registrada', descricao: 'Saída não registrada' };
    }
    return { tipo: 'quantidade_incorreta', descricao: `Esperado: ${esperado} registros, encontrado: ${n}` };
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Detecta todas as pendências num período, excluindo o dia atual.
 *
 * sem_registros: gerado apenas para funcionários que têm ao menos 1 registro
 * no período selecionado (evita ruído de funcionários inativos/sem cadastro).
 */
export function detectarPendencias(
  employees: Employee[],
  records: TimeRecord[],
  startDate: string,
  endDate: string,
): Pendencia[] {
  const today = getTodayStr();

  // Mapa de funcionários ativos
  const empMap = new Map<string, Employee>();
  for (const emp of employees) {
    if (emp.is_active !== false && emp.ativo !== false) {
      empMap.set(emp.id, emp);
    }
  }

  // Agrupar registros por funcionario|data (exclui INVALIDADO, hoje e futuro)
  const grupos = new Map<string, { empId: string; date: string; list: TimeRecord[] }>();
  const empIdsComRegistros = new Set<string>();

  for (const rec of records) {
    if (rec.status === 'INVALIDADO') continue;
    const date = rec.data_hora.slice(0, 10);
    if (date >= today) continue;
    if (date < startDate || date > endDate) continue;

    const key = `${rec.funcionario_id}|${date}`;
    if (!grupos.has(key)) {
      grupos.set(key, { empId: rec.funcionario_id, date, list: [] });
    }
    grupos.get(key)!.list.push(rec);
    empIdsComRegistros.add(rec.funcionario_id);
  }

  const pendencias: Pendencia[] = [];

  // 1. Detectar pendências nos grupos com registros
  for (const [key, { empId, date, list }] of grupos) {
    const emp = empMap.get(empId);
    if (!emp) continue;

    const sorted = [...list].sort((a, b) => a.data_hora.localeCompare(b.data_hora));
    const intervalo = emp.intervalo_padrao_minutos ?? emp.intervalo_emp ?? 0;
    const esperado = intervalo > 0 ? 4 : 2;

    if (sorted.length === esperado) continue; // Correto

    const { tipo, descricao } = classificarPendencia(sorted, intervalo);
    const dateObj = parseLocalDate(date);

    pendencias.push({
      key,
      funcionario_id: empId,
      funcionario_nome: emp.nome,
      cargo: emp.cargo || '',
      data: date,
      data_formatada: formatDate(date),
      dia_semana: DIAS_PT[dateObj.getDay()] ?? '',
      registros: sorted,
      tipo,
      descricao,
      esperado,
      encontrado: sorted.length,
      intervalo_padrao_minutos: intervalo,
    });
  }

  // 2. Detectar sem_registros apenas para funcionários que têm algum registro no período
  //    (evita gerar centenas de falsos positivos para empresas com funcionários novos)
  const periodoStart = parseLocalDate(startDate);
  const periodoEnd   = parseLocalDate(endDate);
  const todayDate    = parseLocalDate(today);
  const limiteEnd    = periodoEnd < todayDate ? periodoEnd : new Date(todayDate.getTime() - 86_400_000);

  for (const empId of empIdsComRegistros) {
    const emp = empMap.get(empId);
    if (!emp) continue;

    const intervalo = emp.intervalo_padrao_minutos ?? emp.intervalo_emp ?? 0;

    for (let cur = new Date(periodoStart); cur <= limiteEnd; cur.setDate(cur.getDate() + 1)) {
      const dateStr = toDateStr(cur);
      const key = `${empId}|${dateStr}`;

      if (grupos.has(key)) continue; // Já analisado acima
      if (!isWorkingDay(cur, emp)) continue;

      const dateObj = parseLocalDate(dateStr);
      pendencias.push({
        key,
        funcionario_id: empId,
        funcionario_nome: emp.nome,
        cargo: emp.cargo || '',
        data: dateStr,
        data_formatada: formatDate(dateStr),
        dia_semana: DIAS_PT[dateObj.getDay()] ?? '',
        registros: [],
        tipo: 'sem_registros',
        descricao: 'Nenhum registro encontrado neste dia útil',
        esperado: intervalo > 0 ? 4 : 2,
        encontrado: 0,
        intervalo_padrao_minutos: intervalo,
      });
    }
  }

  // Ordenar: mais recente primeiro, depois por nome
  pendencias.sort((a, b) =>
    b.data !== a.data
      ? b.data.localeCompare(a.data)
      : a.funcionario_nome.localeCompare(b.funcionario_nome),
  );

  return pendencias;
}

export function calcularResumo(pendencias: Pendencia[]): ResumoCorreções {
  const r: ResumoCorreções = {
    total: pendencias.length,
    saida_nao_registrada: 0,
    intervalo_incompleto: 0,
    sem_registros: 0,
    registros_excedentes: 0,
    quantidade_incorreta: 0,
    proximos: 0,
  };
  for (const p of pendencias) r[p.tipo]++;
  return r;
}

export const LABEL_TIPO: Record<TipoPendencia, string> = {
  saida_nao_registrada: 'Saída faltando',
  intervalo_incompleto: 'Intervalo incompleto',
  sem_registros:        'Sem registros',
  registros_excedentes: 'Registros excedentes',
  quantidade_incorreta: 'Quantidade incorreta',
};

export const COR_TIPO: Record<TipoPendencia, string> = {
  saida_nao_registrada: '#ef4444',
  intervalo_incompleto: '#f59e0b',
  sem_registros:        '#6366f1',
  registros_excedentes: '#ec4899',
  quantidade_incorreta: '#f97316',
};

export const LABEL_PROXIMOS = 'Registros próximos';
export const COR_PROXIMOS   = '#a78bfa';
