/**
 * EspelhoPontoPage
 * Replica funcional de /records/employee/ do front principal.
 * Mesmos endpoints, mesmos cálculos, mesmos dados — interface adaptada para tablet/celular.
 *
 * Endpoints usados (idênticos ao front):
 *  1. GET /api/registros-diarios?employee_id&start_date&end_date&page_size=200
 *  2. GET /api/funcionario/registros?inicio&fim   (normaliza campos do DynamoDB)
 *  3. GET /api/funcionarios/{id}                  (schedule do funcionário)
 *  4. GET /api/configuracoes                      (empresa_uf + weekly_schedule)
 *  5. GET /api/feriados?ano&uf                    (feriados)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import apiService from '../../../services/api';
import Badge from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { TimeRecord, RegistroDiario, FuncionarioUser, WeeklySchedule } from '../../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type DayStatus = 'PRESENTE' | 'FALTA' | 'ATRASO' | 'FERIADO' | 'SEM_REGISTRO';

// Tolerância mensal: se saldo (extras − atrasos) estiver dentro deste limite,
// considera cumprimento integral e zera banco/extras/atrasos na exibição.
const MONTHLY_TOLERANCE_MIN = 120; // 2 horas

interface CalendarDay {
  data: string;        // YYYY-MM-DD
  dia_numero: number;
  dia_semana: string;  // 'dom'...'sab'
  feriado_nome?: string;
  horas_previstas?: string;     // HH:MM from backend
  entrada?: string;             // HH:MM
  saida_intervalo?: string;
  volta_intervalo?: string;
  saida?: string;
  horas_trabalhadas?: string;   // HH:MM
  banco_horas?: string;         // HH:MM with sign
  banco_horas_min?: number;
  atraso_min?: number;
  saida_antecipada_min?: number;
  horas_extras_min?: number;    // minutos extras positivos do dia
  feriado_credit_min?: number;  // horas auto-creditadas para feriados em dias úteis
  status: DayStatus;
  registros: TimeRecord[];
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_KEYS = ['sun','mon','tue','wed','thu','fri','sat'] as const;
const DOW_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DOW_SHORT = ['dom','seg','ter','qua','qui','sex','sab'];

// ── Pure helpers (same as front) ──────────────────────────────────────────────

function toHHMM(totalMin: number): string {
  const sign = totalMin < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalMin));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function parseHHMM(s: string): number {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutosPrevistosDia(
  schedule: { horario_entrada: string; horario_saida: string; intervalo_min: number },
  customSchedule: WeeklySchedule | null,
  companyWeeklySchedule: WeeklySchedule | null,
  dateISO: string
): number {
  // Use noon to avoid DST issues
  const dow = new Date(dateISO + 'T12:00:00').getDay();
  const dayKey = DOW_KEYS[dow];

  let entrada = schedule.horario_entrada;
  let saida = schedule.horario_saida;

  if (customSchedule) {
    const ds = customSchedule[dayKey];
    if (ds?.active === false) return 0;
    entrada = ds?.start || entrada;
    saida = ds?.end || saida;
  } else if (companyWeeklySchedule) {
    const ds = companyWeeklySchedule[dayKey];
    if (!ds) return 0;
    if (ds.active === false) return 0;
    if (ds.start && ds.end) { entrada = ds.start; saida = ds.end; }
  } else {
    if (dow === 0 || dow === 6) return 0; // Dom / Sab
  }

  if (!entrada || !saida) return 0;
  return Math.max(0, parseHHMM(saida) - parseHHMM(entrada) - schedule.intervalo_min);
}

function formatTime(iso: string): string {
  if (!iso) return '--:--';
  if (/^\d{2}:\d{2}$/.test(iso)) return iso;
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function tipoLabel(tipo: string): string {
  const map: Record<string, string> = {
    entrada: 'Entrada', saida: 'Saída',
    intervalo_inicio: 'Saída Intervalo', intervalo_fim: 'Volta Intervalo',
    retorno_almoco: 'Retorno Almoço', saida_almoco: 'Saída Almoço',
    saida_antecipada: 'Saída Antecipada', dia_inteiro: 'Dia Inteiro',
  };
  return map[tipo] ?? tipo;
}

function tipoDot(tipo: string): string {
  if (['entrada','retorno_almoco','intervalo_fim'].includes(tipo)) return 'bg-emerald-500';
  if (['saida','saida_almoco','intervalo_inicio','saida_antecipada'].includes(tipo)) return 'bg-rose-500';
  return 'bg-amber-500';
}

// Status color palette (same as chipColor in front)
function statusStyle(status: DayStatus): { bg: string; border: string; text: string; dot: string } {
  if (status === 'PRESENTE') return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400', dot: 'bg-emerald-500' };
  if (status === 'ATRASO')   return { bg: 'bg-amber-500/15',   border: 'border-amber-500/50',   text: 'text-amber-400',   dot: 'bg-amber-500'   };
  if (status === 'FERIADO')  return { bg: 'bg-yellow-500/15',  border: 'border-yellow-500/50',  text: 'text-yellow-400',  dot: 'bg-yellow-500'  };
  if (status === 'FALTA')    return { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    dot: 'bg-rose-500'    };
  return { bg: '',                    border: 'border-slate-800',            text: 'text-slate-600',   dot: 'bg-slate-700'   };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EspelhoPontoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const func = user as FuncionarioUser;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Data
  const [dailySummariesMap, setDailySummariesMap] = useState<Record<string, RegistroDiario>>({});
  const [rawRecords, setRawRecords] = useState<TimeRecord[]>([]);
  const [employeeSchedule, setEmployeeSchedule] = useState({ horario_entrada: '08:00', horario_saida: '17:00', intervalo_min: 60 });
  const [customSchedule, setCustomSchedule] = useState<WeeklySchedule | null>(null);
  const [companyWeeklySchedule, setCompanyWeeklySchedule] = useState<WeeklySchedule | null>(null);
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [isVariableSchedule, setIsVariableSchedule] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const inicio = `${year}-${String(month).padStart(2, '0')}-01`;
  const fim = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // ── Fetch all data ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!func?.id) return;
    setLoading(true);
    setError(null);

    console.log('[EspelhoPonto] Buscando dados...', { employeeId: func.id, inicio, fim });

    try {
      const [daily, recs, empResp, cfgResp] = await Promise.all([
        apiService.getDailyRegistros(func.id, inicio, fim),
        apiService.getMeusRegistros({ inicio, fim }),
        apiService.getEmployee(func.id).catch(() => null),
        apiService.getCompanyConfig().catch(() => ({})),
      ]);

      console.log('[EspelhoPonto] daily summaries:', daily.length, daily[0]);
      console.log('[EspelhoPonto] raw records:', recs.length, recs[0]);
      console.log('[EspelhoPonto] employee schedule:', empResp);

      // Build dailySummaries map keyed by date
      const map: Record<string, RegistroDiario> = {};
      daily.forEach(s => { if (s.data) map[s.data] = s; });
      setDailySummariesMap(map);
      setRawRecords(recs);

      // Employee schedule
      const rawEntrada = empResp?.horario_entrada;
      const rawSaida   = empResp?.horario_saida;
      setIsVariableSchedule(!rawEntrada || !rawSaida);
      setEmployeeSchedule({
        horario_entrada: rawEntrada || '08:00',
        horario_saida:   rawSaida   || '17:00',
        intervalo_min:   Number(empResp?.intervalo_emp ?? empResp?.duracao_intervalo ?? 60),
      });
      setCustomSchedule(empResp?.custom_schedule || null);
      setCompanyWeeklySchedule(cfgResp?.weekly_schedule || null);

      // Fetch holidays
      const uf = cfgResp?.empresa_uf || '';
      const feriados = await apiService.getFeriados(String(year), uf);
      const ferMap: Record<string, string> = {};
      feriados.forEach(h => {
        const ativo = h?.active !== false && h?.ativo !== false;
        const date = h?.date || h?.data;
        if (ativo && date) ferMap[String(date)] = String(h?.name || h?.nome || 'Feriado');
      });
      setHolidayMap(ferMap);

      console.log('[EspelhoPonto] holidays:', Object.keys(ferMap).length);
    } catch (e: any) {
      console.error('[EspelhoPonto] Erro:', e?.message);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [func?.id, inicio, fim, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Build calendar (same algorithm as front's buildCalendar) ────────────────

  const buildCalendar = useCallback((): CalendarDay[] => {
    const lastDay = new Date(year, month, 0).getDate();
    // Usar data local (não UTC) para evitar bug de fuso UTC+ onde meia-noite
    // local é dia anterior em UTC e toISOString() retornaria a data errada.
    const _n = new Date();
    const todayISO = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`;

    // Group records by day
    const grouped: Record<string, TimeRecord[]> = {};
    rawRecords.forEach(r => {
      if (!r.data_hora) return;
      const raw = r.data_hora.includes('T') ? r.data_hora.split('T')[0] : r.data_hora.split(' ')[0];
      if (!raw) return;
      const segs = raw.split('-');
      const key = segs[0].length === 4 ? raw : `${segs[2]}-${segs[1]}-${segs[0]}`;
      grouped[key] = grouped[key] || [];
      grouped[key].push(r);
    });

    const days: CalendarDay[] = [];
    for (let d = 1; d <= lastDay; d++) {
      // Formatar ISO sem conversão UTC para preservar data local corretamente
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const records = grouped[iso] || [];
      // dow via Date às 12:00 (evita problemas de DST/UTC na extração do dia da semana)
      const dow = new Date(`${iso}T12:00:00`).getDay();
      const isPast = iso <= todayISO;
      const feriadoNome = holidayMap[iso];
      const isHoliday = Boolean(feriadoNome);
      const summary = dailySummariesMap[iso];

      // Expected minutes: backend primary, local fallback
      const previstoMin = summary
        ? Number(summary.horas_previstas_min ?? 0)
        : minutosPrevistosDia(employeeSchedule, customSchedule, companyWeeklySchedule, iso);
      const isWorkday = !isVariableSchedule && previstoMin > 0;

      // Crédito automático para feriados em dias úteis — APENAS jornada fixa.
      // Horário variável não tem carga diária definida: crédito automático não se aplica.
      const feriadoCreditMin = isHoliday && records.length === 0 && !isVariableSchedule
        ? minutosPrevistosDia(employeeSchedule, customSchedule, companyWeeklySchedule, iso)
        : 0;

      // ── Status determinado EXCLUSIVAMENTE pelo dailySummary (fonte canônica) ──
      // rawRecords.length NUNCA é usado para determinar presença/falta.
      // rawRecords serve apenas para a tabela de detalhes (drilldown).
      const summaryWorked = summary ? Number(summary.horas_trabalhadas_min || 0) : 0;
      const summaryAtraso = summary ? Number(summary.atraso_minutos || 0) : 0;

      let status: DayStatus = 'SEM_REGISTRO';
      if (isHoliday) {
        status = 'FERIADO';
      } else if (summaryWorked > 0) {
        // Horas calculadas pelo motor canônico → funcionário presente
        status = summaryAtraso > 0 ? 'ATRASO' : 'PRESENTE';
      } else if (isWorkday && isPast) {
        status = 'FALTA';
      }

      // Horas previstas: dias úteis normais + feriados com crédito automático
      const horasPrevistasStr =
        (isWorkday && !isHoliday)
          ? (summary?.horas_previstas_str || toHHMM(previstoMin))
          : feriadoCreditMin > 0
            ? toHHMM(feriadoCreditMin)
            : undefined;

      days.push({
        data: iso,
        dia_numero: d,
        dia_semana: DOW_SHORT[dow],
        feriado_nome: feriadoNome,
        horas_previstas: horasPrevistasStr,
        entrada: summary?.hora_entrada || undefined,
        saida_intervalo: summary?.intervalo_saida || undefined,
        volta_intervalo: summary?.intervalo_volta || undefined,
        saida: summary?.hora_saida || undefined,
        horas_trabalhadas: summary?.horas_trabalhadas_str || undefined,
        banco_horas: summary?.banco_horas_dia_str || undefined,
        banco_horas_min: summary?.banco_horas_dia,
        atraso_min: summary?.atraso_minutos,
        saida_antecipada_min: summary?.saida_antecipada_minutos,
        horas_extras_min: summary ? Number(summary.horas_extras_min ?? summary.horas_extras ?? 0) : undefined,
        feriado_credit_min: feriadoCreditMin > 0 ? feriadoCreditMin : undefined,
        status, registros: records,
      });
    }
    return days;
  }, [year, month, rawRecords, dailySummariesMap, holidayMap, employeeSchedule, customSchedule, companyWeeklySchedule, isVariableSchedule]);

  const calendarDays = buildCalendar();
  // Inclui dias com registros reais OU com summary do backend (safety net para paginação)
  const daysWithRecords = calendarDays.filter(d =>
    d.registros.length > 0 ||
    (dailySummariesMap[d.data] && Number(dailySummariesMap[d.data].horas_trabalhadas_min || 0) > 0)
  );
  // Feriados em dias úteis sem registros reais: aparecem na tabela com crédito automático
  const feriadosAutoCredit = calendarDays.filter(
    d => d.status === 'FERIADO' && (d.feriado_credit_min ?? 0) > 0 && d.registros.length === 0
  );
  const allDisplayDays = [...daysWithRecords, ...feriadosAutoCredit];
  const daysSorted = [...allDisplayDays].sort((a, b) => {
    const c = a.data.localeCompare(b.data);
    return sortDir === 'asc' ? c : -c;
  });

  // ── Resumo ────────────────────────────────────────────────────────────────────

  const resumo = (() => {
    const _r = new Date();
    const todayISO = `${_r.getFullYear()}-${String(_r.getMonth()+1).padStart(2,'0')}-${String(_r.getDate()).padStart(2,'0')}`;

    let totalMinTrabalhados = 0;
    let totalMinPrevistos   = 0;
    let totalMinExtras      = 0; // soma de dias com saldo positivo
    let totalMinAtrasos     = 0; // soma de atraso_min + saida_antecipada_min

    // Agregar resumos diários do backend (fonte de verdade)
    Object.entries(dailySummariesMap).forEach(([iso, s]) => {
      if (iso > todayISO) return;
      totalMinTrabalhados += Number(s.horas_trabalhadas_min || 0);
      totalMinPrevistos   += Number(s.horas_previstas_min  || 0);
      totalMinExtras      += Number(s.horas_extras_min ?? s.horas_extras ?? 0);
      totalMinAtrasos     += Number(s.atraso_minutos || 0) + Number(s.saida_antecipada_minutos || 0);
    });

    // Crédito automático de feriados — apenas jornada fixa
    if (!isVariableSchedule) {
      calendarDays.forEach(day => {
        if (day.status !== 'FERIADO') return;
        if (day.data > todayISO) return;
        if (dailySummariesMap[day.data]) return;
        const credit = day.feriado_credit_min ?? 0;
        if (credit > 0) {
          totalMinTrabalhados += credit;
          totalMinPrevistos   += credit;
        }
      });
    }

    // Tolerância mensal: se saldo (extras − atrasos) ≤ 2h → cumprimento integral
    const saldoBruto = totalMinExtras - totalMinAtrasos;
    const toleranciaAplicada = !isVariableSchedule && Math.abs(saldoBruto) <= MONTHLY_TOLERANCE_MIN;
    const saldoFinal         = toleranciaAplicada ? 0 : saldoBruto;
    const displayExtras      = toleranciaAplicada ? 0 : totalMinExtras;
    const displayAtrasos     = toleranciaAplicada ? 0 : totalMinAtrasos;
    // Quando tolerância aplicada: exibe previsto como trabalhado (sem minutos sobrando)
    const displayTrabalhado  = toleranciaAplicada ? totalMinPrevistos : totalMinTrabalhados;

    // Presença: dias com registro + feriados em dias úteis contam como presente
    const presentes = calendarDays.filter(d => {
      if (d.status === 'PRESENTE' || d.status === 'ATRASO') return true;
      if (d.status === 'FERIADO' && d.data <= todayISO && (d.feriado_credit_min ?? 0) > 0) return true;
      return false;
    }).length;

    const faltas  = calendarDays.filter(d => d.status === 'FALTA').length;
    const atrasos = calendarDays.filter(d => d.status === 'ATRASO').length;

    // Dias úteis previstos até hoje (inclui feriados com crédito)
    const diasUteisPrevistosAteHoje = calendarDays.filter(d => {
      if (d.data > todayISO) return false;
      if (d.status === 'FERIADO') return (d.feriado_credit_min ?? 0) > 0;
      return !!(d.horas_previstas && d.horas_previstas !== '00:00');
    }).length;

    const cumprimento = Math.round((displayTrabalhado / (totalMinPrevistos || 1)) * 100);

    console.log('[EspelhoPonto] resumo:', {
      presentes, faltas, atrasos, totalMinExtras, totalMinAtrasos,
      saldoBruto, toleranciaAplicada, saldoFinal, displayTrabalhado,
    });

    return {
      presentes, faltas, atrasos,
      percent: Math.round((presentes / (diasUteisPrevistosAteHoje || 1)) * 100),
      totalMinPrevistos,
      totalMinTrabalhados: displayTrabalhado,
      totalMinExtras: displayExtras,
      totalMinAtrasos: displayAtrasos,
      saldoMin: saldoFinal,
      toleranciaAplicada,
      cumprimento,
      previsto:    toHHMM(totalMinPrevistos),
      trabalhado:  toHHMM(displayTrabalhado),
      extras:      toHHMM(displayExtras),
      atrasosStr:  toHHMM(displayAtrasos),
      saldo:       toHHMM(saldoFinal),
    };
  })();

  // ── Navigation ───────────────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (!isCurrentMonth) {
      if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    }
  };

  // ── PDF Export ───────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 15;

      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(`ESPELHO DE PONTO — ${func?.nome?.toUpperCase() ?? ''}`, pageW / 2, y, { align: 'center' }); y += 7;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${inicio} a ${fim}`, pageW / 2, y, { align: 'center' }); y += 6;
      doc.text(`Presentes: ${resumo.presentes}  |  Faltas: ${resumo.faltas}  |  Trabalhado: ${resumo.trabalhado}  |  Previsto: ${resumo.previsto}  |  Extras: ${resumo.extras}  |  Atrasos: ${resumo.atrasosStr}  |  Banco: ${resumo.saldo}`, pageW / 2, y, { align: 'center' }); y += 8;

      // Table header
      doc.setFillColor(30, 41, 59);
      doc.rect(15, y, pageW - 30, 6, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8);
      const cols = [15, 40, 65, 90, 115, 140, 165, 195, 220];
      const hdrs = ['Data','Dia','Entrada','Saída Int.','Volta Int.','Saída','Trabalhado','Previsto','Banco'];
      hdrs.forEach((h, i) => doc.text(h, cols[i] + 1, y + 4));
      doc.setTextColor(0, 0, 0); y += 8;

      daysSorted.forEach((day, idx) => {
        if (y > 190) { doc.addPage(); y = 15; }
        if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(15, y - 3, pageW - 30, 6, 'F'); }
        doc.setFontSize(8);
        const isFAC = day.status === 'FERIADO' && (day.feriado_credit_min ?? 0) > 0 && day.registros.length === 0;
        const row = [
          day.data.split('-').reverse().join('/'),
          isFAC ? `${day.dia_semana.toUpperCase()} [F]` : day.dia_semana.toUpperCase(),
          isFAC ? 'FERIADO' : (day.entrada || '—'),
          isFAC ? (day.feriado_nome || 'Feriado') : (day.saida_intervalo || '—'),
          isFAC ? '—' : (day.volta_intervalo || '—'),
          isFAC ? '—' : (day.saida || '—'),
          isFAC ? toHHMM(day.feriado_credit_min!) : (day.horas_trabalhadas || '—'),
          isFAC ? toHHMM(day.feriado_credit_min!) : (day.horas_previstas || '—'),
          isFAC ? '00:00' : (day.banco_horas || '00:00'),
        ];
        row.forEach((v, i) => doc.text(v, cols[i] + 1, y + 1));
        y += 6;
      });

      doc.save(`espelho_${func?.nome?.replace(/\s/g, '_') ?? 'funcionario'}_${year}-${String(month).padStart(2, '0')}.pdf`);
    } catch (e) { console.error(e); } finally { setExporting(false); }
  };

  // ── Calendar cell ─────────────────────────────────────────────────────────────

  const CalendarCell = ({ day }: { day: CalendarDay }) => {
    const st = statusStyle(day.status);
    const hasData = day.registros.length > 0;
    const symbol = day.status === 'PRESENTE' ? '✓' : day.status === 'ATRASO' ? '!' : day.status === 'FERIADO' ? 'F' : day.status === 'FALTA' ? '✗' : '';

    return (
      <button
        onClick={() => hasData ? setExpandedDay(expandedDay === day.data ? null : day.data) : undefined}
        className={`rounded-xl text-center py-2 px-1 min-h-[52px] flex flex-col items-center justify-center transition-all border ${
          day.status !== 'SEM_REGISTRO' ? st.bg + ' ' + st.border : 'border-slate-800'
        } ${hasData ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}`}
      >
        <span className={`font-bold text-sm ${
          day.status === 'SEM_REGISTRO' ? 'text-slate-500' : 'text-white'
        }`}>{day.dia_numero}</span>
        {symbol && (
          <span className={`text-[10px] font-bold ${st.text}`}>{symbol}</span>
        )}
      </button>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate('/funcionario')}
            className="p-2.5 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-slate-50">Espelho de Ponto</h1>
            {func?.nome && (
              <p className="text-slate-500 text-sm mt-0.5 truncate">
                {func.nome}{func.cargo ? ` · ${func.cargo}` : ''}
                {isVariableSchedule && <span className="ml-2 text-xs text-amber-400">Horário variável</span>}
              </p>
            )}
          </div>
          <button
            onClick={fetchData}
            title="Atualizar"
            className="p-2.5 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Month picker */}
        <div className="flex items-center justify-between bg-slate-800 rounded-2xl p-1.5">
          <button onClick={prevMonth} className="p-2.5 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <span className="text-slate-100 font-bold text-base capitalize">
              {MONTHS[month - 1]} {year}
            </span>
            {isCurrentMonth && (
              <span className="ml-2 text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">atual</span>
            )}
          </div>
          <button
            onClick={nextMonth}
            className={`p-2.5 rounded-xl transition-colors ${isCurrentMonth ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {loading ? (
          <div className="px-4 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} height="90px" />)}
            </div>
            <Skeleton height="280px" />
            {[...Array(4)].map((_, i) => <Skeleton key={i} height="64px" />)}
          </div>
        ) : error ? (
          <div className="text-center py-20 px-4 space-y-4">
            <div className="w-14 h-14 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-rose-400 font-medium">{error}</p>
            <button onClick={fetchData} className="px-5 py-2.5 bg-slate-800 text-slate-200 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="px-4 py-5 space-y-5">
            {/* ── 6 Summary Cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Presentes */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Presentes</p>
                </div>
                <p className="text-3xl font-black text-white">{resumo.presentes} <span className="text-slate-500 text-lg font-medium">dias</span></p>
                <p className="text-slate-500 text-xs mt-1">{resumo.percent}% dos dias úteis</p>
              </div>

              {/* Faltas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Faltas</p>
                </div>
                <p className="text-3xl font-black text-white">{resumo.faltas} <span className="text-slate-500 text-lg font-medium">dias</span></p>
                <p className="text-slate-500 text-xs mt-1">
                  {isVariableSchedule ? 'Horário variável' : resumo.atrasos > 0 ? `${resumo.atrasos} atraso(s)` : 'Sem faltas'}
                </p>
              </div>

              {/* Horas Trabalhadas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Horas</p>
                </div>
                <p className="text-2xl font-black text-white font-mono">
                  {resumo.trabalhado}
                  {!isVariableSchedule && (
                    <span className="text-slate-500 font-normal text-sm"> / {resumo.previsto}</span>
                  )}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {isVariableSchedule
                    ? 'Horas registradas'
                    : `${resumo.cumprimento}% de cumprimento`}
                </p>
              </div>

              {/* Horas Extras */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className={`w-4 h-4 ${isVariableSchedule ? 'text-slate-500' : resumo.totalMinExtras > 0 ? 'text-violet-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">H. Extras</p>
                </div>
                {isVariableSchedule ? (
                  <p className="text-2xl font-black text-slate-600 font-mono">—</p>
                ) : (
                  <p className={`text-2xl font-black font-mono ${resumo.totalMinExtras > 0 ? 'text-violet-400' : 'text-slate-500'}`}>
                    {resumo.extras}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-1">
                  {isVariableSchedule ? 'Horário variável' : 'Tempo excedente acumulado'}
                </p>
              </div>

              {/* Atrasos */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className={`w-4 h-4 ${isVariableSchedule ? 'text-slate-500' : resumo.totalMinAtrasos > 0 ? 'text-amber-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                  </svg>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Atrasos</p>
                </div>
                {isVariableSchedule ? (
                  <p className="text-2xl font-black text-slate-600 font-mono">—</p>
                ) : (
                  <p className={`text-2xl font-black font-mono ${resumo.totalMinAtrasos > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {resumo.atrasosStr}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-1">
                  {isVariableSchedule ? 'Horário variável' : 'Tempo abaixo da jornada'}
                </p>
              </div>

              {/* Banco de Horas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className={`w-4 h-4 ${isVariableSchedule ? 'text-slate-500' : resumo.saldoMin > 0 ? 'text-emerald-400' : resumo.saldoMin < 0 ? 'text-rose-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Banco</p>
                </div>
                {isVariableSchedule ? (
                  <p className="text-2xl font-black text-slate-600 font-mono">—</p>
                ) : (
                  <p className={`text-2xl font-black font-mono ${resumo.saldoMin > 0 ? 'text-emerald-400' : resumo.saldoMin < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {resumo.saldoMin > 0 ? '+' : ''}{resumo.saldo}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-1">
                  {isVariableSchedule
                    ? 'Horário variável'
                    : resumo.toleranciaAplicada
                      ? 'Dentro da tolerância'
                      : resumo.saldoMin > 0 ? 'Saldo positivo' : resumo.saldoMin < 0 ? 'Saldo negativo' : 'Zerado'}
                </p>
              </div>
            </div>

            {/* ── Calendar grid ──────────────────────────────────────────────── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-slate-300 font-bold text-sm">Calendário do Mês</span>
                </div>
                {!isVariableSchedule && employeeSchedule.horario_entrada && (
                  <span className="text-slate-600 text-xs">
                    {employeeSchedule.horario_entrada}–{employeeSchedule.horario_saida} (-{employeeSchedule.intervalo_min}min)
                  </span>
                )}
              </div>

              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DOW_LABELS.map(d => (
                  <div key={d} className="text-center text-slate-500 text-xs font-bold py-1">{d}</div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Offset for first day of month */}
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                  <div key={`off-${i}`} />
                ))}
                {calendarDays.map(day => <CalendarCell key={day.data} day={day} />)}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-800">
                {[
                  { symbol: '✓', color: 'text-emerald-400', label: 'Presente' },
                  { symbol: '!', color: 'text-amber-400',   label: 'Atraso' },
                  { symbol: 'F', color: 'text-yellow-400',  label: 'Feriado' },
                  { symbol: '✗', color: 'text-rose-400',    label: 'Falta' },
                  { symbol: '○', color: 'text-slate-500',   label: 'Sem reg.' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${l.color}`}>{l.symbol}</span>
                    <span className="text-xs text-slate-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Export PDF ──────────────────────────────────────────────────── */}
            <button
              onClick={handleExportPDF}
              disabled={exporting || daysWithRecords.length === 0}
              className="w-full flex items-center justify-center gap-3 bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500 rounded-2xl px-4 py-3.5 transition-all font-semibold disabled:opacity-40"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Exportando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar PDF
                </>
              )}
            </button>

            {/* ── Detail table ────────────────────────────────────────────────── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-slate-300 font-bold text-sm">
                    Registros do Mês
                    <span className="text-slate-500 font-normal ml-1 text-xs">({daysSorted.length} dias)</span>
                  </span>
                </div>
                <button
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDir === 'asc' ? "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"} />
                  </svg>
                  {sortDir === 'asc' ? 'Mais antigo' : 'Mais recente'}
                </button>
              </div>

              {daysSorted.length === 0 ? (
                <div className="text-center py-16 px-5">
                  <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 text-base font-medium">Nenhum registro neste período</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {daysSorted.map(day => {
                    const st = statusStyle(day.status);
                    const isOpen = expandedDay === day.data;
                    const bancoPositivo = (day.banco_horas_min ?? 0) >= 0;
                    const isFeriadoAutoCredit = day.status === 'FERIADO' && (day.feriado_credit_min ?? 0) > 0 && day.registros.length === 0;

                    // ── Linha de feriado com crédito automático ──────────────
                    if (isFeriadoAutoCredit) {
                      return (
                        <div key={day.data}
                          className="px-5 py-4 flex items-center gap-3"
                          style={{ borderLeft: '3px solid #eab308' }}
                        >
                          <div className="w-16 flex-shrink-0">
                            <p className="text-white font-bold text-sm font-mono">{day.data.slice(8)}/{day.data.slice(5, 7)}</p>
                            <p className="text-slate-500 text-xs uppercase">{day.dia_semana}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                                Feriado
                              </span>
                              {day.feriado_nome && (
                                <span className="text-xs text-yellow-400/80 truncate">{day.feriado_nome}</span>
                              )}
                            </div>
                            <div className="flex gap-4 mt-1.5 text-xs text-slate-400">
                              <span>Previsto: <span className="text-slate-300 font-mono">{toHHMM(day.feriado_credit_min!)}</span></span>
                              <span>Trabalhado: <span className="text-slate-300 font-mono">{toHHMM(day.feriado_credit_min!)}</span></span>
                              <span>Banco: <span className="text-slate-400 font-mono">00:00</span></span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ── Linha com summary mas sem raw records (paginação incompleta) ─
                    const hasSummaryOnly = day.registros.length === 0 && dailySummariesMap[day.data];
                    if (hasSummaryOnly) {
                      const s = dailySummariesMap[day.data];
                      return (
                        <div key={day.data}
                          className="px-5 py-4 flex items-center gap-3 border-l-[3px] border-emerald-500/50"
                        >
                          <div className="w-16 flex-shrink-0">
                            <p className="text-white font-bold text-sm font-mono">{day.data.slice(8)}/{day.data.slice(5,7)}</p>
                            <p className="text-slate-500 text-xs uppercase">{day.dia_semana}</p>
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-2 text-center min-w-0">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-semibold">Entrada</p>
                              <p className="text-sm font-mono font-semibold text-emerald-400">{s.hora_entrada || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-semibold">Saída</p>
                              <p className="text-sm font-mono font-semibold text-rose-400">{s.hora_saida || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-semibold">Total</p>
                              <p className="text-sm font-mono font-bold text-white">{s.horas_trabalhadas_str || '—'}</p>
                            </div>
                          </div>
                          {s.banco_horas_dia_str && !isVariableSchedule && (
                            <span className={`text-xs font-mono font-bold flex-shrink-0 ${Number(s.banco_horas_dia ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {Number(s.banco_horas_dia ?? 0) >= 0 ? '+' : ''}{s.banco_horas_dia_str}
                            </span>
                          )}
                        </div>
                      );
                    }

                    // ── Linha normal com registros ────────────────────────────
                    return (
                      <div key={day.data}>
                        {/* Day summary row */}
                        <button
                          onClick={() => setExpandedDay(isOpen ? null : day.data)}
                          className={`w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-slate-800/50 transition-colors ${isOpen ? 'bg-slate-800/30' : ''}`}
                          style={{ borderLeft: `3px solid ${day.status === 'ATRASO' ? '#f59e0b' : day.status === 'PRESENTE' ? '#10b981' : day.status === 'FERIADO' ? '#eab308' : '#334155'}` }}
                        >
                          {/* Date */}
                          <div className="w-16 flex-shrink-0">
                            <p className="text-white font-bold text-sm font-mono">{day.data.slice(8)}/{day.data.slice(5, 7)}</p>
                            <p className="text-slate-500 text-xs uppercase">{day.dia_semana}</p>
                          </div>

                          {/* Times */}
                          <div className="flex-1 grid grid-cols-3 gap-2 text-center min-w-0">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-semibold">Entrada</p>
                              <p className="text-sm font-mono font-semibold text-emerald-400">{day.entrada || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-semibold">Saída</p>
                              <p className="text-sm font-mono font-semibold text-rose-400">{day.saida || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-semibold">Total</p>
                              <p className="text-sm font-mono font-bold text-white">{day.horas_trabalhadas || '—'}</p>
                            </div>
                          </div>

                          {/* Status badges + expand */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {day.status === 'FERIADO' && (
                              <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/15 border border-yellow-500/25 px-1.5 py-0.5 rounded-full">F</span>
                            )}
                            {day.banco_horas && !isVariableSchedule && (
                              <span className={`text-xs font-mono font-bold ${bancoPositivo ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {bancoPositivo ? '+' : ''}{day.banco_horas}
                              </span>
                            )}
                            {day.atraso_min && day.atraso_min > 0 && (
                              <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                                +{day.atraso_min}m
                              </span>
                            )}
                            <svg
                              className={`w-4 h-4 text-slate-600 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-slate-950/50 border-t border-slate-800">
                                {/* Extra summary fields */}
                                <div className="px-5 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                                  {day.status === 'FERIADO' && day.feriado_nome && (
                                    <div className="flex justify-between text-xs col-span-2">
                                      <span className="text-yellow-400/70">Feriado</span>
                                      <span className="text-yellow-400 font-medium">{day.feriado_nome}</span>
                                    </div>
                                  )}
                                  {day.saida_intervalo && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Saída Int.</span>
                                      <span className="text-slate-300 font-mono">{day.saida_intervalo}</span>
                                    </div>
                                  )}
                                  {day.volta_intervalo && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Volta Int.</span>
                                      <span className="text-slate-300 font-mono">{day.volta_intervalo}</span>
                                    </div>
                                  )}
                                  {day.horas_previstas && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Previsto</span>
                                      <span className="text-slate-300 font-mono">{day.horas_previstas}</span>
                                    </div>
                                  )}
                                  {day.banco_horas && !isVariableSchedule && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Banco dia</span>
                                      <span className={`font-mono font-semibold ${bancoPositivo ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {bancoPositivo ? '+' : ''}{day.banco_horas}
                                      </span>
                                    </div>
                                  )}
                                  {(day.atraso_min ?? 0) > 0 && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Atraso</span>
                                      <span className="text-amber-400 font-mono">{toHHMM(day.atraso_min!)}</span>
                                    </div>
                                  )}
                                  {(day.saida_antecipada_min ?? 0) > 0 && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Saída Ant.</span>
                                      <span className="text-amber-400 font-mono">{toHHMM(day.saida_antecipada_min!)}</span>
                                    </div>
                                  )}
                                  {(day.horas_extras_min ?? 0) > 0 && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">H. Extra dia</span>
                                      <span className="text-violet-400 font-mono">+{toHHMM(day.horas_extras_min!)}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Individual punches */}
                                <div className="px-5 pb-2">
                                  <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-2">
                                    Marcações — {day.registros.length} registro(s)
                                  </p>
                                  <div className="space-y-1.5">
                                    {day.registros.map((r, i) => {
                                      const recStatus = (r as any).status?.toUpperCase() || 'ATIVO';
                                      return (
                                        <div key={i} className="flex items-center gap-3">
                                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tipoDot(r.tipo)}`} />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium text-slate-300">{tipoLabel(r.tipo)}</span>
                                              {r.editado && <Badge variant="warning">Editado</Badge>}
                                              {recStatus === 'INVALIDADO' && <Badge variant="danger">Invalidado</Badge>}
                                              {(r as any).method === 'MANUAL' && (
                                                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Manual</span>
                                              )}
                                            </div>
                                            {r.justificativa && (
                                              <p className="text-xs text-slate-500 mt-0.5 truncate">{r.justificativa}</p>
                                            )}
                                          </div>
                                          <span className="text-sm font-mono text-slate-200 font-bold flex-shrink-0">
                                            {formatTime(r.data_hora)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ──────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 flex">
        {[
          {
            path: '/funcionario',
            label: 'Início',
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
          },
          {
            path: '/funcionario/espelho',
            label: 'Espelho',
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
          },
          {
            path: '/funcionario/configuracoes',
            label: 'Config',
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
          },
        ].map(({ path, label, icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center gap-1 py-4 transition-colors ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {icon}
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
