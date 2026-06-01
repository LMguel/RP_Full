import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Typography,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  Tooltip,
  Button,
  Card,
  CardContent,
} from '@mui/material';
import UnifiedRecordsFilter from '../components/UnifiedRecordsFilter';
import TimeRecordForm from '../components/TimeRecordForm';
import { motion } from 'framer-motion';
import XLSXStyle from 'xlsx-js-style';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Employee, WeeklyScheduleMap, WeekdayKey } from '../types';

const MONTHLY_TOLERANCE_MIN = 120;

// ── Tipos ────────────────────────────────────────────────────────────────────

type StatusPeriodo = 'VARIAVEL' | 'REGULAR' | 'INCOMPLETO' | 'SEM_REGISTROS';

interface EmployeeSummary {
  employee_id: string;
  funcionario_nome: string;
  horas_trabalhadas: number;
  horas_previstas: number;
  horas_extras: number;
  atrasos: number;
  saldo: number;
  presentes: number;
  atrasos_count: number;
  incompletos_count: number;
  variavel: boolean;
  toleranciaAplicada: boolean;
  statusPeriodo: StatusPeriodo;
  diasEsperados: number;   // dias úteis esperados no período
  faltas: number;          // diasEsperados - presentes
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const _DOW_KEYS: WeekdayKey[] = ['sun','mon','tue','wed','thu','fri','sat'];

/** Conta dias úteis esperados no período para um funcionário. */
function calcDiasEsperados(emp: Employee, start: string, end: string): number {
  if (!emp.horario_entrada || !emp.horario_saida) return 0;
  const sDate = new Date(start + 'T12:00:00');
  const eDate = new Date(end + 'T12:00:00');
  let count = 0;
  for (const d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
    const key = _DOW_KEYS[d.getDay()];
    if (emp.custom_schedule) {
      const ds = (emp.custom_schedule as WeeklyScheduleMap)[key];
      if (ds && ds.active !== false && ds.start && ds.end) count++;
    } else {
      // Fallback: Seg-Sex
      if (d.getDay() >= 1 && d.getDay() <= 5) count++;
    }
  }
  return count;
}

// ── Componente ────────────────────────────────────────────────────────────────

const RecordsSummaryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  type EmployeeOption = { id: string; nome: string; cargo?: string };

  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeSummary[]>([]);
  const [dailyByEmployee, setDailyByEmployee] = useState<Record<string, any[]>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [statusFilter, setStatusFilter] = useState<'TODOS' | StatusPeriodo>('TODOS');

  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const [dateRange, setDateRange] = useState({
    start_date: currentMonthStart.toISOString().split('T')[0],
    end_date:   currentMonthEnd.toISOString().split('T')[0],
  });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [snackbarOpen, setSnackbarOpen]       = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success'|'error'|'warning'|'info'>('success');
  const [formOpen, setFormOpen]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dados da empresa (para Excel)
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaCnpj, setEmpresaCnpj] = useState('');

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const toHHMM = (min: number): string => {
    const sign = min < 0 ? '-' : '';
    const abs = Math.abs(Math.round(min));
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  };

  const toSignedHHMM = (min: number): string => {
    const abs = Math.abs(Math.round(min));
    const sign = min > 0 ? '+' : min < 0 ? '-' : '';
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  };

  const getFirstDayOfMonth  = (ym: string) => { const [y,m]=ym.split('-').map(Number); return `${y}-${String(m).padStart(2,'0')}-01`; };
  const getLastDayOfMonth   = (ym: string) => { const [y,m]=ym.split('-').map(Number); const l=new Date(y,m,0).getDate(); return `${y}-${String(m).padStart(2,'0')}-${String(l).padStart(2,'0')}`; };
  const getCurrentMonth     = () => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; };
  const getMonthFromDate    = (s: string) => { if(!s) return ''; const d=new Date(s); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
  const showSnackbar = (msg: string, sev: typeof snackbarSeverity) => { setSnackbarMessage(msg); setSnackbarSeverity(sev); setSnackbarOpen(true); };

  // ── Buscar dados ──────────────────────────────────────────────────────────────

  const buscarRegistros = useCallback(async () => {
    if (dateRange.start_date && dateRange.end_date && dateRange.start_date > dateRange.end_date) {
      setError('A data de início não pode ser maior que a data de fim.');
      setEmployeeSummaries([]);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = { page_size: '5000' };
      if (dateRange.start_date) params.start_date = dateRange.start_date;
      if (dateRange.end_date)   params.end_date   = dateRange.end_date;
      if (selectedEmployee?.id) params.employee_id = selectedEmployee.id;

      // Busca paralela: summaries + todos os funcionários ativos
      const [dailyResp, empResp] = await Promise.all([
        apiService.get('/api/registros-diarios', params),
        apiService.getEmployees(),
      ]);

      const dailyList: any[] = dailyResp?.summaries || [];
      const allEmps: Employee[] = empResp?.funcionarios || [];

      // Agrupar dias por employee_id
      const byEmpDays: Record<string, any[]> = {};
      for (const day of dailyList) {
        const empId = String(day.employee_id || '');
        if (!empId) continue;
        byEmpDays[empId] = byEmpDays[empId] || [];
        byEmpDays[empId].push(day);
      }
      setDailyByEmployee(byEmpDays);

      // Criar sumário para TODOS os funcionários ativos
      const summaries: EmployeeSummary[] = allEmps
        .filter(emp => emp.is_active !== false && (emp as any).ativo !== false)
        .map(emp => {
          const days = byEmpDays[emp.id] || [];
          const variavel = !emp.horario_entrada || !emp.horario_saida;

          let minTrabalhados = 0, minPrevistos = 0, minExtras = 0, minAtrasos = 0;
          let presentes = 0, atrasosCount = 0, incompletos = 0;

          for (const d of days) {
            const trabMin = Number(d.horas_trabalhadas_min || 0);
            minTrabalhados += trabMin;
            minPrevistos   += Number(d.horas_previstas_min  || 0);
            minExtras      += Number(d.horas_extras_min ?? d.horas_extras ?? 0);
            minAtrasos     += Number(d.atraso_minutos || 0) + Number(d.saida_antecipada_minutos || 0);
            if (trabMin > 0 || (d.n_punches || 0) > 0) {
              presentes++;
              if (d.status === 'INCOMPLETO') incompletos++;
              if (Number(d.atraso_minutos || 0) > 0) atrasosCount++;
            }
          }

          // Dias esperados e estimativa de faltas (apenas jornada fixa)
          const diasEsperados = variavel ? 0 : calcDiasEsperados(
            emp,
            dateRange.start_date || currentMonthStart.toISOString().split('T')[0],
            dateRange.end_date   || currentMonthEnd.toISOString().split('T')[0],
          );
          const faltas = variavel ? 0 : Math.max(0, diasEsperados - presentes);

          // Tolerância mensal
          const saldoBruto = minExtras - minAtrasos;
          const toleranciaAplicada = !variavel && Math.abs(saldoBruto) <= MONTHLY_TOLERANCE_MIN;
          const saldoFinal         = toleranciaAplicada ? 0 : saldoBruto;
          const displayExtras      = toleranciaAplicada ? 0 : minExtras;
          const displayAtrasos     = toleranciaAplicada ? 0 : minAtrasos;
          const displayTrabalhado  = toleranciaAplicada ? minPrevistos : minTrabalhados;

          // Status do período
          let statusPeriodo: StatusPeriodo;
          if (variavel) {
            statusPeriodo = 'VARIAVEL';
          } else if (days.length === 0) {
            statusPeriodo = 'SEM_REGISTROS';
          } else if (incompletos > 0) {
            statusPeriodo = 'INCOMPLETO';
          } else {
            statusPeriodo = 'REGULAR';
          }

          const nome = days[0]?.nome || emp.nome || emp.id;

          return {
            employee_id:       emp.id,
            funcionario_nome:  nome,
            horas_trabalhadas: displayTrabalhado,
            horas_previstas:   minPrevistos,
            horas_extras:      displayExtras,
            atrasos:           displayAtrasos,
            saldo:             saldoFinal,
            presentes,
            atrasos_count:     atrasosCount,
            incompletos_count: incompletos,
            variavel,
            toleranciaAplicada,
            statusPeriodo,
            diasEsperados,
            faltas,
          };
        });

      summaries.sort((a, b) => (a.funcionario_nome).localeCompare(b.funcionario_nome));
      setEmployeeSummaries(summaries);

    } catch (err: any) {
      console.error('❌ Erro ao buscar resumo:', err);
      setError('Erro ao carregar resumo. Tente novamente.');
      showSnackbar('Erro ao carregar resumo', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange.start_date, dateRange.end_date, selectedEmployee?.id]);

  // ── Filtros ───────────────────────────────────────────────────────────────────

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setDateRange(month
      ? { start_date: getFirstDayOfMonth(month), end_date: getLastDayOfMonth(month) }
      : { start_date: '', end_date: '' });
  };
  const handleDateRangeChange = (newRange: typeof dateRange) => {
    const n = { start_date: newRange.start_date || '', end_date: newRange.end_date || '' };
    setDateRange(n);
    if (n.start_date && n.end_date) {
      const m1 = getMonthFromDate(n.start_date), m2 = getMonthFromDate(n.end_date);
      setSelectedMonth(m1 === m2 ? m1 : '');
    } else setSelectedMonth('');
  };
  const handleClearFilters = () => {
    setDateRange({ start_date: currentMonthStart.toISOString().split('T')[0], end_date: currentMonthEnd.toISOString().split('T')[0] });
    setSelectedMonth(''); setSelectedEmployee(null); setStatusFilter('TODOS');
  };

  // ── Efeitos ───────────────────────────────────────────────────────────────────

  useEffect(() => { buscarRegistros(); }, [buscarRegistros]);

  useEffect(() => {
    apiService.getEmployees().then((r: any) => {
      const list = [...(r.funcionarios || [])].sort((a: Employee, b: Employee) => (a.nome||'').localeCompare(b.nome||''));
      setEmployees(list);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiService.get('/api/empresa/dados').then((r: any) => {
      setEmpresaNome(r?.empresa_nome_display || user?.empresa_nome || '');
      setEmpresaCnpj(r?.empresa_cnpj || '');
    }).catch(() => {
      setEmpresaNome(user?.empresa_nome || '');
    });
  }, [user]);

  useEffect(() => {
    const m = getCurrentMonth();
    setSelectedMonth(m);
    setDateRange({ start_date: getFirstDayOfMonth(m), end_date: getLastDayOfMonth(m) });
  }, []);

  // ── Formulário ────────────────────────────────────────────────────────────────

  const handleSaveRecord = async (recordData: any) => {
    setSubmitting(true);
    try {
      await apiService.registerTimeManual(recordData);
      showSnackbar('Registro adicionado com sucesso!', 'success');
      setFormOpen(false);
      buscarRegistros();
    } catch {
      showSnackbar('Erro ao adicionar registro.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cards e filtros ───────────────────────────────────────────────────────────

  const regularCount     = employeeSummaries.filter(s => s.statusPeriodo === 'REGULAR').length;
  const semRegistroCount = employeeSummaries.filter(s => s.statusPeriodo === 'SEM_REGISTROS').length;
  const incompletoCount  = employeeSummaries.filter(s => s.statusPeriodo === 'INCOMPLETO').length;
  const variavelCount    = employeeSummaries.filter(s => s.statusPeriodo === 'VARIAVEL').length;

  const filteredSummaries = statusFilter === 'TODOS'
    ? employeeSummaries
    : employeeSummaries.filter(s => s.statusPeriodo === statusFilter);

  const statusChipConfig: Record<StatusPeriodo, { label: string; bg: string; border: string; color: string }> = {
    REGULAR:      { label: 'Regular',       bg: 'rgba(16,185,129,0.15)',  border: '#10b981', color: '#10b981' },
    INCOMPLETO:   { label: 'Incompleto',    bg: 'rgba(245,158,11,0.15)',  border: '#f59e0b', color: '#f59e0b' },
    SEM_REGISTROS:{ label: 'Sem registros', bg: 'rgba(239,68,68,0.15)',   border: '#ef4444', color: '#ef4444' },
    VARIAVEL:     { label: 'Variável',      bg: 'rgba(139,92,246,0.15)',  border: '#8b5cf6', color: '#8b5cf6' },
  };

  // ── Export Excel ──────────────────────────────────────────────────────────────

  const exportToExcel = async () => {
    if (employeeSummaries.length === 0) return;
    showSnackbar('Gerando Excel, aguarde...', 'info');
    try {
      const bThin  = { style: 'thin',   color: { rgb: '000000' } };
      const bThick = { style: 'medium', color: { rgb: '000000' } };
      const bAll   = { top: bThin, bottom: bThin, left: bThin, right: bThin };
      const bBox   = { top: bThick, bottom: bThick, left: bThick, right: bThick };
      const W      = { fgColor: { rgb: 'FFFFFF' } };
      const GRAY   = { fgColor: { rgb: 'D9D9D9' } };
      const BLUE   = { fgColor: { rgb: 'C9DAF8' } };
      const GREEN  = { fgColor: { rgb: 'D9EAD3' } };
      const RED    = { fgColor: { rgb: 'FCE5CD' } };
      const YELLOW = { fgColor: { rgb: 'FFF2CC' } };

      const sTitle   = { font: { bold: true, sz: 13 }, fill: GRAY, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: bBox };
      const sMeta    = { font: { sz: 11 }, fill: W, alignment: { horizontal: 'left', vertical: 'center' }, border: bAll };
      const sHdr     = (left = false) => ({ font: { bold: true, sz: 11 }, fill: GRAY, alignment: { horizontal: left ? 'left' : 'center', vertical: 'center', wrapText: true }, border: bAll });
      const sCell    = (bold = false, left = false) => ({ font: { bold, sz: 11 }, fill: W, alignment: { horizontal: left ? 'left' : 'center', vertical: 'center', wrapText: true }, border: bAll });
      const sSaldo   = (pos: boolean) => ({ font: { bold: true, sz: 11 }, fill: pos ? GREEN : RED, alignment: { horizontal: 'center', vertical: 'center' }, border: bAll });
      const sExtras  = { font: { bold: true, sz: 11 }, fill: BLUE,   alignment: { horizontal: 'center', vertical: 'center' }, border: bAll };
      const sAtraso  = { font: { bold: true, sz: 11 }, fill: YELLOW, alignment: { horizontal: 'center', vertical: 'center' }, border: bAll };
      const sEmpty   = { font: { sz: 10 }, fill: W, border: bAll };

      const periodo = `${dateRange.start_date || '—'} a ${dateRange.end_date || '—'}`;
      const geradoEm = new Date().toLocaleString('pt-BR');
      const cnpjFmt = empresaCnpj ? empresaCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
      const wb      = XLSXStyle.utils.book_new();
      const COLS_G  = ['A','B','C','D','E','F','G','H','I','J'];
      const styleRowG = (ws: any, r: number, fn: (ci: number) => any) =>
        COLS_G.forEach((c, ci) => { const ref = c + r; if (ws[ref]) ws[ref].s = fn(ci); });

      const resumoAoa: any[][] = [
        ['RESUMO GERAL DE PONTO', '', '', '', '', '', '', '', '', ''],
        [empresaNome ? `Empresa: ${empresaNome}${cnpjFmt ? ` — CNPJ: ${cnpjFmt}` : ''}` : '', '', '', '', '', '', '', '', '', ''],
        [`Período: ${periodo}`, '', '', '', '', '', '', '', '', ''],
        [`Gerado em: ${geradoEm}`, '', '', '', '', '', '', '', '', ''],
        ['Funcionário', 'Status', 'Presentes', 'H. Trabalhadas', 'H. Previstas', 'H. Extras', 'Atrasos', 'Banco', 'Faltas Est.', ''],
        ...employeeSummaries.map(s => {
          const cfg = statusChipConfig[s.statusPeriodo];
          return [
            s.funcionario_nome,
            cfg.label,
            s.presentes,
            toHHMM(s.horas_trabalhadas),
            s.variavel ? '—' : toHHMM(s.horas_previstas),
            s.variavel ? '—' : toHHMM(s.horas_extras),
            s.variavel ? '—' : toHHMM(s.atrasos),
            s.variavel ? '—' : toSignedHHMM(s.saldo),
            s.variavel ? '—' : String(s.faltas),
            '',
          ];
        }),
        ['TOTAL', '',
          employeeSummaries.reduce((a,s) => a + s.presentes, 0),
          toHHMM(employeeSummaries.reduce((a,s) => a + s.horas_trabalhadas, 0)),
          toHHMM(employeeSummaries.reduce((a,s) => a + s.horas_previstas, 0)),
          toHHMM(employeeSummaries.filter(s=>!s.variavel).reduce((a,s) => a + s.horas_extras, 0)),
          toHHMM(employeeSummaries.filter(s=>!s.variavel).reduce((a,s) => a + s.atrasos, 0)),
          toSignedHHMM(employeeSummaries.filter(s=>!s.variavel).reduce((a,s) => a + s.saldo, 0)),
          String(employeeSummaries.filter(s=>!s.variavel).reduce((a,s) => a + s.faltas, 0)),
          '',
        ],
      ];

      const wsG = XLSXStyle.utils.aoa_to_sheet(resumoAoa);
      styleRowG(wsG, 1, () => sTitle);
      styleRowG(wsG, 2, () => sMeta);
      styleRowG(wsG, 3, () => sMeta);
      styleRowG(wsG, 4, () => sMeta);
      styleRowG(wsG, 5, (ci) => ci < 9 ? sHdr(ci === 0) : sEmpty);
      employeeSummaries.forEach((s, ri) => {
        styleRowG(wsG, 6 + ri, (ci) => {
          if (ci === 0) return sCell(false, true);
          if (ci === 5) return sExtras;
          if (ci === 6) return sAtraso;
          if (ci === 7) return sSaldo(!s.variavel ? s.saldo >= 0 : true);
          if (ci === 9) return sEmpty;
          return sCell(ci === 8);
        });
      });
      const totalRow = 6 + employeeSummaries.length;
      styleRowG(wsG, totalRow, (ci) => {
        if (ci === 0) return { ...sHdr(true) };
        if (ci === 5) return sExtras;
        if (ci === 6) return sAtraso;
        if (ci === 7) return sSaldo(employeeSummaries.filter(s=>!s.variavel).reduce((a,s)=>a+s.saldo,0) >= 0);
        if (ci === 9) return sEmpty;
        return sCell(true);
      });
      wsG['!cols'] = [{ wch:30 }, { wch:14 }, { wch:12 }, { wch:16 }, { wch:16 }, { wch:14 }, { wch:14 }, { wch:14 }, { wch:12 }, { wch:4 }];
      wsG['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:9} }, { s:{r:1,c:0}, e:{r:1,c:9} }, { s:{r:2,c:0}, e:{r:2,c:9} }, { s:{r:3,c:0}, e:{r:3,c:9} }];
      (wsG as any)['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      XLSXStyle.utils.book_append_sheet(wb, wsG, 'Resumo Geral');

      // Abas individuais por funcionário
      const COLS8 = ['A','B','C','D','E','F','G','H','I','J'];
      const styleRow = (ws: any, r: number, fn: (ci: number) => any) =>
        COLS8.forEach((c, ci) => { const ref = c + r; if (ws[ref]) ws[ref].s = fn(ci); });

      for (const summary of employeeSummaries) {
        const days: any[] = (dailyByEmployee[summary.employee_id] || [])
          .slice().sort((a, b) => (a.data || '').localeCompare(b.data || ''));
        const nome = summary.funcionario_nome;
        const pct  = summary.variavel ? '—' : Math.round((summary.horas_trabalhadas / (summary.horas_previstas || 1)) * 100) + '%';

        const aoa: any[][] = [
          ['ESPELHO DE PONTO — ' + nome.toUpperCase(), '','','','','','','','',''],
          [empresaNome ? `${empresaNome}${cnpjFmt ? ` — CNPJ: ${cnpjFmt}` : ''}` : '', '','','','','','','','',''],
          [`Período: ${periodo}`, '','','','','','','','',''],
          [`Gerado em: ${geradoEm}`, '','','','','','','','',''],
          ['Presentes', 'H. Trabalhadas', 'H. Previstas', 'H. Extras', 'Atrasos', 'Banco de Horas', '% Cumprimento', '', '', ''],
          [
            summary.presentes,
            toHHMM(summary.horas_trabalhadas),
            summary.variavel ? '—' : toHHMM(summary.horas_previstas),
            summary.variavel ? '—' : toHHMM(summary.horas_extras),
            summary.variavel ? '—' : toHHMM(summary.atrasos),
            summary.variavel ? '—' : toSignedHHMM(summary.saldo),
            pct, '', '', '',
          ],
          ['', '', '', '', '', '', '', '', '', ''],
          ['Data', 'Dia', 'Entrada', 'Saída Int.', 'Volta Int.', 'Saída', 'Trabalhado', 'Previsto', 'H. Extra', 'Banco Dia'],
          ...days.map(d => {
            const extrasMin = Number(d.horas_extras_min ?? d.horas_extras ?? 0);
            const bancoMin  = Number(d.banco_horas_dia ?? 0);
            const dataFmt   = (d.data || '').split('-').reverse().join('/');
            const diasPT    = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
            const dow       = d.dia_semana ? diasPT.indexOf(d.dia_semana) : new Date((d.data||'') + 'T12:00:00').getDay();
            return [
              dataFmt,
              d.dia_semana || (dow >= 0 ? diasPT[dow] : ''),
              d.hora_entrada  || '—',
              d.intervalo_saida || '—',
              d.intervalo_volta || '—',
              d.hora_saida    || '—',
              d.horas_trabalhadas_str || toHHMM(Number(d.horas_trabalhadas_min || 0)),
              d.horas_previstas_str   || (d.horas_previstas_min != null ? toHHMM(Number(d.horas_previstas_min)) : '—'),
              extrasMin > 0  ? toHHMM(extrasMin)   : '—',
              bancoMin  !== 0 ? toSignedHHMM(bancoMin) : '00:00',
            ];
          }),
        ];

        const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
        styleRow(ws, 1, () => sTitle);
        styleRow(ws, 2, () => sMeta);
        styleRow(ws, 3, () => sMeta);
        styleRow(ws, 4, () => sMeta);
        styleRow(ws, 5, (ci) => ci < 7 ? sHdr() : sEmpty);
        styleRow(ws, 6, (ci) => {
          if (ci === 5) return sSaldo(summary.saldo >= 0);
          if (ci === 3) return sExtras;
          if (ci === 4) return sAtraso;
          if (ci >= 7)  return sEmpty;
          return sCell(true);
        });
        styleRow(ws, 7, () => sEmpty);
        styleRow(ws, 8, (ci) => sHdr(ci === 0 || ci === 1));
        days.forEach((d, ri) => {
          const bancoMin = Number(d.banco_horas_dia ?? 0);
          styleRow(ws, 9 + ri, (ci) => {
            if (ci === 0 || ci === 1) return sCell(false, true);
            if (ci === 8) return sExtras;
            if (ci === 9) return sSaldo(bancoMin >= 0);
            return sCell();
          });
        });
        ws['!cols'] = [{wch:14},{wch:6},{wch:10},{wch:12},{wch:12},{wch:10},{wch:14},{wch:14},{wch:12},{wch:12}];
        ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:9} },{ s:{r:1,c:0}, e:{r:1,c:9} },{ s:{r:2,c:0}, e:{r:2,c:9} },{ s:{r:3,c:0}, e:{r:3,c:9} },{ s:{r:7,c:0}, e:{r:7,c:9} }];
        (ws as any)['!pageSetup'] = { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 };
        (ws as any)['!margins'] = { left:0.5, right:0.5, top:0.75, bottom:0.75, header:0.3, footer:0.3 };
        XLSXStyle.utils.book_append_sheet(wb, ws, nome.replace(/[:\\/\[\]*?]/g,'').slice(0,31));
      }

      const period = dateRange.start_date ? dateRange.start_date.slice(0,7) : 'periodo';
      XLSXStyle.writeFile(wb, `Espelho-Geral-${period}.xlsx`);
      showSnackbar('Excel exportado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao exportar:', err);
      showSnackbar('Erro ao gerar Excel', 'error');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const colSx = {
    color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: 11,
    textTransform: 'uppercase' as const, letterSpacing: 0.4,
    borderBottom: '1px solid rgba(255,255,255,0.1)', py: 1.5, px: 1.5, whiteSpace: 'nowrap' as const,
  };

  const FILTER_OPTS: Array<{ key: 'TODOS' | StatusPeriodo; label: string; count: number; color: string }> = [
    { key: 'TODOS',         label: 'Todos',           count: employeeSummaries.length,  color: 'rgba(255,255,255,0.6)' },
    { key: 'REGULAR',       label: '✓ Regulares',     count: regularCount,              color: '#10b981' },
    { key: 'INCOMPLETO',    label: '⚠ Incompletos',   count: incompletoCount,           color: '#f59e0b' },
    { key: 'SEM_REGISTROS', label: '✗ Sem registros', count: semRegistroCount,          color: '#ef4444' },
    { key: 'VARIAVEL',      label: '~ Variáveis',     count: variavelCount,             color: '#8b5cf6' },
  ];

  return (
    <PageLayout>
      <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold text-white">Espelho De Ponto</h1>
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-lg"
            >
              + Adicionar Registro Manual
            </button>
          </div>
        </motion.div>

        {/* Cards de resumo */}
        {!loading && (
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr 1fr', md:'repeat(4,1fr)' }, gap:2, mb:3 }}>
              {[
                { label:'Regulares',        value: regularCount,      color:'#10b981', icon:'✓', sub:`${regularCount} funcionário(s)` },
                { label:'Incompletos',       value: incompletoCount,   color:'#f59e0b', icon:'⚠', sub: incompletoCount > 0 ? 'Batidas faltando' : 'Nenhum' },
                { label:'Sem registros',     value: semRegistroCount,  color:'#ef4444', icon:'✗', sub: semRegistroCount > 0 ? 'No período' : 'Nenhum' },
                { label:'Horário variável',  value: variavelCount,     color:'#8b5cf6', icon:'~', sub:'Sem jornada fixa' },
              ].map((card, i) => (
                <Card key={i} sx={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:2, cursor:'pointer' }}
                  onClick={() => setStatusFilter((['REGULAR','INCOMPLETO','SEM_REGISTROS','VARIAVEL'] as StatusPeriodo[])[i])}>
                  <CardContent sx={{ p:'16px !important' }}>
                    <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <Typography sx={{ color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:600 }}>{card.label}</Typography>
                      <Typography sx={{ color: card.color, fontSize:18, fontWeight:800 }}>{card.icon}</Typography>
                    </Box>
                    <Typography sx={{ color:'white', fontWeight:800, fontSize:28, mt:0.5 }}>{card.value}</Typography>
                    <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)' }}>{card.sub}</Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </motion.div>
        )}

        <Paper sx={{ borderRadius:2, background:'rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
          <UnifiedRecordsFilter
            selectedEmployee={selectedEmployee}
            onEmployeeChange={setSelectedEmployee}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            onClearFilters={handleClearFilters}
            onExportExcel={exportToExcel}
            showExportButton={true}
            exportDisabled={employeeSummaries.length === 0}
            exportLabel="EXPORTAR GERAL"
            employees={employees}
          />

          <Box sx={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)' }} />

          {/* Filtros por status */}
          <Box sx={{ px:3, pt:2, display:'flex', gap:1, flexWrap:'wrap' }}>
            {FILTER_OPTS.map(opt => (
              <Button key={opt.key} size="small" onClick={() => setStatusFilter(opt.key)}
                sx={{
                  fontSize:11, fontWeight:700, px:1.5, py:0.5, borderRadius:1.5,
                  background: statusFilter === opt.key ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${statusFilter === opt.key ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: statusFilter === opt.key ? opt.color : 'rgba(255,255,255,0.5)',
                  '&:hover': { background:'rgba(255,255,255,0.1)' },
                }}>
                {opt.label} ({opt.count})
              </Button>
            ))}
          </Box>

          <Box sx={{ p:3, pt:2 }}>
            <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1.5 }}>
              <Typography variant="h6" sx={{ fontWeight:700, color:'rgba(255,255,255,0.9)', fontSize:18 }}>
                Resumo por Funcionário
                <Typography component="span" sx={{ color:'rgba(255,255,255,0.45)', fontSize:14, ml:1 }}>
                  ({filteredSummaries.length})
                </Typography>
              </Typography>
            </Box>

            <Alert severity="info" variant="outlined" sx={{ mb:2.5, background:'linear-gradient(90deg,rgba(2,136,209,0.06),rgba(14,165,233,0.02))', borderColor:'rgba(14,165,233,0.3)', color:'rgba(255,255,255,0.9)', fontWeight:600, py:1, px:2 }}>
              Clique no nome para ver o <strong>espelho individual</strong> completo
            </Alert>

            {loading ? (
              <Box sx={{ display:'flex', justifyContent:'center', py:6 }}><CircularProgress sx={{ color:'rgba(255,255,255,0.7)' }} /></Box>
            ) : error ? (
              <Alert severity="error" sx={{ my:2 }}>{error}</Alert>
            ) : (
              <TableContainer sx={{ background:'transparent', overflowX:'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...colSx, textAlign:'left', pl:2 }}>Funcionário</TableCell>
                      <TableCell align="center" sx={colSx}>Status</TableCell>
                      <TableCell align="center" sx={colSx}>Dias</TableCell>
                      <TableCell align="center" sx={colSx}>Faltas Est.</TableCell>
                      <TableCell align="center" sx={colSx}>Trabalhado / Previsto</TableCell>
                      <TableCell align="center" sx={{ ...colSx, color:'#a78bfa' }}>H. Extras</TableCell>
                      <TableCell align="center" sx={{ ...colSx, color:'#f59e0b' }}>Atrasos</TableCell>
                      <TableCell align="center" sx={colSx}>Banco</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py:8, border:'none' }}>
                          <Typography variant="h6" sx={{ color:'rgba(255,255,255,0.5)', mb:1 }}>Nenhum registro encontrado</Typography>
                          <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.35)' }}>Ajuste os filtros para visualizar</Typography>
                        </TableCell>
                      </TableRow>
                    ) : filteredSummaries.map((s) => {
                      const pct = s.variavel ? null : Math.round((s.horas_trabalhadas / (s.horas_previstas || 1)) * 100);
                      const cfg = statusChipConfig[s.statusPeriodo];
                      const isSemReg = s.statusPeriodo === 'SEM_REGISTROS';
                      return (
                        <TableRow
                          key={s.employee_id}
                          hover
                          sx={{ cursor:'pointer', '& td':{ borderBottom:'1px solid rgba(255,255,255,0.06)' }, '&:hover':{ background:'rgba(255,255,255,0.04)' }, borderLeft: isSemReg ? '3px solid #ef4444' : s.statusPeriodo === 'INCOMPLETO' ? '3px solid #f59e0b' : 'none' }}
                          onClick={() => navigate(`/records/employee/${s.employee_id}/${encodeURIComponent(s.funcionario_nome)}`)}
                        >
                          {/* Funcionário */}
                          <TableCell sx={{ py:1.5, pl:2 }}>
                            <Typography sx={{ fontWeight:700, color: isSemReg ? 'rgba(255,255,255,0.5)' : 'white', fontSize:13 }}>{s.funcionario_nome}</Typography>
                            {s.toleranciaAplicada && !s.variavel && (
                              <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', fontSize:10 }}>tolerância aplicada</Typography>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell align="center">
                            <Chip label={cfg.label} size="small" sx={{ height:18, fontSize:10, fontWeight:700, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color }} />
                          </TableCell>

                          {/* Dias */}
                          <TableCell align="center">
                            <Typography sx={{ fontWeight:700, color: isSemReg ? 'rgba(255,255,255,0.35)' : 'white', fontSize:13, fontFamily:'monospace' }}>
                              {isSemReg ? '—' : s.presentes}
                            </Typography>
                            {s.incompletos_count > 0 && (
                              <Typography variant="caption" sx={{ color:'#f59e0b', fontSize:10 }}>⚠ {s.incompletos_count} incompl.</Typography>
                            )}
                          </TableCell>

                          {/* Faltas estimadas */}
                          <TableCell align="center">
                            {s.variavel ? (
                              <Typography sx={{ color:'rgba(255,255,255,0.25)', fontSize:13 }}>—</Typography>
                            ) : (
                              <Typography sx={{ fontWeight:700, fontFamily:'monospace', fontSize:13, color: s.faltas > 0 ? '#ef4444' : 'rgba(255,255,255,0.35)' }}>
                                {s.faltas > 0 ? s.faltas : (isSemReg ? '?' : '0')}
                              </Typography>
                            )}
                          </TableCell>

                          {/* Horas Trabalhadas / Previstas */}
                          <TableCell align="center">
                            <Typography sx={{ fontWeight:700, color: isSemReg ? 'rgba(255,255,255,0.25)' : 'white', fontSize:13, fontFamily:'monospace' }}>
                              {isSemReg ? '—' : toHHMM(s.horas_trabalhadas)}
                            </Typography>
                            {!s.variavel && !isSemReg && (
                              <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontFamily:'monospace' }}>
                                / {toHHMM(s.horas_previstas)}
                              </Typography>
                            )}
                          </TableCell>

                          {/* H. Extras */}
                          <TableCell align="center">
                            {s.variavel || isSemReg ? (
                              <Typography sx={{ color:'rgba(255,255,255,0.25)', fontSize:13 }}>—</Typography>
                            ) : (
                              <Typography sx={{ fontWeight:700, fontFamily:'monospace', fontSize:13, color: s.horas_extras > 0 ? '#a78bfa' : 'rgba(255,255,255,0.35)' }}>
                                {toHHMM(s.horas_extras)}
                              </Typography>
                            )}
                          </TableCell>

                          {/* Atrasos */}
                          <TableCell align="center">
                            {s.variavel || isSemReg ? (
                              <Typography sx={{ color:'rgba(255,255,255,0.25)', fontSize:13 }}>—</Typography>
                            ) : (
                              <Typography sx={{ fontWeight:700, fontFamily:'monospace', fontSize:13, color: s.atrasos > 0 ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}>
                                {toHHMM(s.atrasos)}
                              </Typography>
                            )}
                          </TableCell>

                          {/* Banco */}
                          <TableCell align="center">
                            {s.variavel || isSemReg ? (
                              <Typography sx={{ color:'rgba(255,255,255,0.25)', fontSize:13 }}>—</Typography>
                            ) : (
                              <Tooltip title={s.toleranciaAplicada ? 'Dentro da tolerância de 2h' : s.saldo > 0 ? 'Saldo positivo' : s.saldo < 0 ? 'Saldo negativo' : 'Zerado'}>
                                <Typography sx={{ fontWeight:800, fontFamily:'monospace', fontSize:13, color: s.saldo > 0 ? '#10b981' : s.saldo < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                                  {s.saldo > 0 ? '+' : ''}{toHHMM(s.saldo)}
                                </Typography>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>

        <TimeRecordForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSaveRecord}
          loading={submitting}
          employees={employees}
        />

        <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical:'bottom', horizontal:'right' }} sx={{ marginLeft:'240px', marginBottom:'20px', zIndex:9999 }}>
          <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width:'100%' }}>{snackbarMessage}</Alert>
        </Snackbar>
      </div>
    </PageLayout>
  );
};

export default RecordsSummaryPage;
