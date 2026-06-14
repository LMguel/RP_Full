import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  TableSortLabel,
  Collapse,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  FileDownload as FileDownloadIcon,
  AccessTime as AccessTimeIcon,
  Clear as ClearIcon,
  CalendarMonth as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  CameraAlt as CameraIcon,
  EditNote as EditNoteIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { Tooltip, Popover } from '@mui/material';
import { motion } from 'framer-motion';
import XLSXStyle from 'xlsx-js-style';
import { apiService } from '../services/api';
import { TimeRecord, Employee, WeeklyScheduleMap } from '../types';

interface EmployeeWithRecords extends Employee {
  registros?: TimeRecord[];
  totalHoras?: string;
  ultimoRegistro?: TimeRecord;
}

// Tolerância mensal: saldo (extras − atrasos) ≤ 2h → cumprimento integral
const MONTHLY_TOLERANCE_MIN = 120;

interface RegistroDia {
  data: string;
  dia_numero: number;
  dia_semana: string;
  feriado_nome?: string;
  horas_previstas?: string;
  entrada?: string;
  saida_intervalo?: string;
  volta_intervalo?: string;
  saida?: string;
  horas_trabalhadas?: string;
  horas_extras?: string;        // banco_horas_dia_str (campo legado)
  atraso_min?: number;
  saida_antecipada_min?: number;
  horas_extras_min?: number;    // minutos extras positivos do dia
  feriado_credit_min?: number;  // crédito automático para feriados em dias úteis
  status: 'PRESENTE' | 'FALTA' | 'ATRASO' | 'FERIADO' | 'SEM_REGISTRO' | 'INCOMPLETO' | 'EM_PROCESSAMENTO' | 'FERIAS' | 'ATESTADO';
  atestado_url?: string;
  cor: 'verde' | 'vermelho' | 'laranja' | 'azul' | 'cinza' | 'amarelo';
  registros: TimeRecord[];
}

const dialogFieldSx = {
  '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.45)' } },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.45)' },
  '& option': { color: 'black' },
};

const EmployeeRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { employeeId, employeeName } = useParams<{ employeeId: string; employeeName: string }>();
  const { search: locationSearch } = useLocation();

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithRecords | null>(null);
  const [selectedEmployeeRecords, setSelectedEmployeeRecords] = useState<TimeRecord[]>([]);
  // Resumos diários do backend (fonte única de verdade para cálculos)
  const [dailySummaries, setDailySummaries] = useState<Record<string, any>>({});
  const [cargaHorariaMensal, setCargaHorariaMensal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const p = new URLSearchParams(locationSearch).get('month');
    const n = new Date();
    return p || `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  });
  const [dateFrom, setDateFrom] = useState(() => {
    const p = new URLSearchParams(locationSearch).get('month');
    const n = new Date();
    const ym = p || `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
    const [y, m] = ym.split('-').map(Number);
    return `${y}-${String(m).padStart(2,'0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const p = new URLSearchParams(locationSearch).get('month');
    const n = new Date();
    const ym = p || `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
    const [y, m] = ym.split('-').map(Number);
    const l = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2,'0')}-${String(l).padStart(2,'0')}`;
  });
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<TimeRecord | null>(null);
  const [invalidateJustificativa, setInvalidateJustificativa] = useState('');
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [recordToAdjust, setRecordToAdjust] = useState<TimeRecord | null>(null);
  const [adjustData, setAdjustData] = useState({ date: '', time: '', justificativa: '' });
  const [justificativaAnchorEl, setJustificativaAnchorEl] = useState<HTMLElement | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [activeHolidayMap, setActiveHolidayMap] = useState<Record<string, string>>({});
  const [isVariableSchedule, setIsVariableSchedule] = useState(false);
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [addRecordData, setAddRecordData] = useState({ date: '', time: '', justificativa: '' });
  const [addRecordSubmitting, setAddRecordSubmitting] = useState(false);

  // Horário do funcionário (buscado da API)
  const [funcionarioSchedule, setFuncionarioSchedule] = useState<{
    horario_entrada: string;
    horario_saida: string;
    intervalo_min: number;
  }>({ horario_entrada: '08:00', horario_saida: '17:00', intervalo_min: 60 });
  const [customSchedule, setCustomSchedule] = useState<WeeklyScheduleMap | null>(null);
  const [companyWeeklySchedule, setCompanyWeeklySchedule] = useState<WeeklyScheduleMap | null>(null);
  const [toleranciaEmpresa, setToleranciaEmpresa] = useState<number>(5);

  const getFirstDayOfMonth = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${y}-${String(m).padStart(2,'0')}-01`; };
  const getLastDayOfMonth = (ym: string) => { const [y, m] = ym.split('-').map(Number); const l = new Date(y,m,0).getDate(); return `${y}-${String(m).padStart(2,'0')}-${String(l).padStart(2,'0')}`; };
  const getCurrentMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; };
  const getMonthFromDate = (ds: string) => { if (!ds) return ''; const d = new Date(ds); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };

  const shiftMonth = (delta: number) => {
    const [y, m] = (selectedMonth || getCurrentMonth()).split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    setSelectedMonth(ym); setDateFrom(getFirstDayOfMonth(ym)); setDateTo(getLastDayOfMonth(ym));
  };

  const monthLabel = () => {
    const [y, m] = (selectedMonth || getCurrentMonth()).split('-');
    return new Date(Number(y), Number(m)-1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const showSnackbar = (msg: string, sev: 'success' | 'error' | 'warning' | 'info') => { setSnackbarMessage(msg); setSnackbarSeverity(sev); setSnackbarOpen(true); };

  const toHHMM = (totalMin: number) => {
    const sign = totalMin < 0 ? '-' : '';
    const abs = Math.abs(totalMin);
    return `${sign}${String(Math.floor(abs/60)).padStart(2,'0')}:${String(abs%60).padStart(2,'0')}`;
  };

  // Calcula minutos previstos por dia. Usado APENAS como fallback para dias sem resumo do backend.
  // Prioridade: custom_schedule do funcionário > weekly_schedule da empresa > padrão Seg-Sex.
  // descontarIntervalo: true = jornada líquida (falta, feriado, tooltip); false = janela bruta.
  const minutosPrevistosDia = (schedule: typeof funcionarioSchedule, dateISO?: string, descontarIntervalo: boolean = true): number => {
    const parseHHMM = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
    let entrada = schedule.horario_entrada;
    let saida = schedule.horario_saida;

    if (dateISO) {
      const dow = new Date(dateISO + 'T12:00:00').getDay(); // 0=Dom, 6=Sab
      const dayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[dow];

      if (customSchedule) {
        // 1. Horário específico do funcionário
        const ds = customSchedule[dayKey];
        if (ds?.active === false) return 0;
        entrada = ds?.start || entrada;
        saida = ds?.end || saida;
      } else if (companyWeeklySchedule) {
        // 2. Horário semanal da empresa
        const ds = companyWeeklySchedule[dayKey];
        if (ds?.active === false) return 0;
        if (ds?.start && ds?.end) { entrada = ds.start; saida = ds.end; }
        else if (!ds) return 0; // dia não configurado = não trabalha
      } else {
        // 3. Fallback legado: padrão Seg-Sex; Sáb/Dom = não trabalha
        if (dow === 0 || dow === 6) return 0;
      }
    }

    if (!entrada || !saida) return 0;
    const bruto = parseHHMM(saida) - parseHHMM(entrada);
    const desconto = descontarIntervalo ? schedule.intervalo_min : 0;
    return Math.max(0, bruto - desconto);
  };

  // Converte data_hora (DD-MM-YYYY HH:MM:SS  ou  YYYY-MM-DDTHH:MM:SS) para Date
  const parseDataHora = (s: string): Date => {
    if (!s) return new Date(0);
    const [datePart, timePart = ''] = s.includes('T') ? s.split('T') : s.split(' ');
    const segs = datePart.split('-');
    const iso = segs[0].length === 4
      ? `${datePart}T${timePart}`          // já YYYY-MM-DD
      : `${segs[2]}-${segs[1]}-${segs[0]}T${timePart}`; // DD-MM-YYYY → YYYY-MM-DD
    return new Date(iso);
  };

  const TIPOS_SAIDA = ['saida', 'saída', 'saida_final', 'saida_almoco', 'saida_antecipada'];
  const TIPOS_ENTRADA = ['entrada', 'retorno_almoco'];


  const formatDateTime = (s: string) => {
    if (!s) return { date: '-', time: '-' };
    let date='', time='';
    if (s.includes(' ')) { [date, time]=s.split(' '); }
    else if (s.includes('T')) { [date, time]=s.split('T'); time=time.split('.')[0]; }
    else return { date: s, time: '' };
    if (date.includes('-')) { const parts=date.split('-'); if (parts[0].length===4) { const [y,m,d]=parts; date=`${d}/${m}/${y}`; } else { const [d,m,y]=parts; date=`${d}/${m}/${y}`; } }
    return { date, time: (time||'').substring(0,5) };
  };

  const getStatusText = (tipo: string) => {
    const labels: Record<string,string> = {
      entrada: 'Entrada',
      saida: 'Saída',
      'saída': 'Saída',
      saida_almoco: 'Saída Almoço',
      retorno_almoco: 'Retorno Almoço',
      intervalo_inicio: 'Saída Intervalo',
      intervalo_fim: 'Volta Intervalo',
      retorno: 'Volta Intervalo',
      saida_antecipada: 'Saída Antecipada',
      dia_inteiro: 'Dia Inteiro',
    };
    return labels[tipo.toLowerCase()] || tipo;
  };

  const chipColor = (status: string) => {
    if (status==='PRESENTE')   return { bg:'rgba(16,185,129,0.15)', border:'#10b981', color:'#10b981' };
    if (status==='ATRASO')     return { bg:'rgba(245,158,11,0.15)', border:'#f59e0b', color:'#f59e0b' };
    if (status==='INCOMPLETO') return { bg:'rgba(234,179,8,0.18)',  border:'#eab308', color:'#eab308' };
    if (status==='FERIADO')    return { bg:'rgba(250,204,21,0.2)',  border:'#facc15', color:'#facc15' };
    if (status==='FALTA')           return { bg:'rgba(239,68,68,0.15)',    border:'#ef4444',                color:'#ef4444' };
    if (status==='EM_PROCESSAMENTO') return { bg:'rgba(100,116,139,0.12)', border:'rgba(100,116,139,0.35)', color:'rgba(148,163,184,0.8)' };
    if (status==='FERIAS')    return { bg:'rgba(139,92,246,0.15)', border:'#8b5cf6', color:'#a78bfa' };
    if (status==='ATESTADO')  return { bg:'rgba(20,184,166,0.15)', border:'#14b8a6', color:'#2dd4bf' };
    return { bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.5)' };
  };

  const buscarRegistrosFuncionario = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const recordsParams: any = { funcionario_id: employeeId, employee_id: employeeId };
      if (dateFrom) recordsParams.inicio = dateFrom;
      if (dateTo) recordsParams.fim = dateTo;

      const summaryParams: any = { employee_id: employeeId, page_size: 200 };
      if (dateFrom) summaryParams.start_date = dateFrom;
      if (dateTo) summaryParams.end_date = dateTo;

      const [recordsResp, summariesResp] = await Promise.all([
        apiService.getTimeRecords(recordsParams),
        apiService.get('/api/registros-diarios', summaryParams).catch(() => null),
      ]);

      const records: TimeRecord[] = Array.isArray(recordsResp) ? recordsResp : [];
      const sorted = [...records].sort((a, b) => parseDataHora(a.data_hora || '').getTime() - parseDataHora(b.data_hora || '').getTime());
      setSelectedEmployeeRecords(sorted);
      setSelectedEmployee({ id: employeeId, nome: employeeName || 'Funcionario', cargo: '', foto_url: '', face_id: '', empresa_nome: '', empresa_id: '', data_cadastro: new Date().toISOString(), registros: sorted, ultimoRegistro: sorted[sorted.length - 1] });

      const summaryList: any[] = summariesResp?.summaries || [];
      const map: Record<string, any> = {};
      summaryList.forEach((s: any) => {
        const key = s.data || s.date;
        if (key) map[key] = s;
      });
      setDailySummaries(map);
    } catch {
      showSnackbar('Erro ao carregar historico', 'error');
    } finally {
      setLoading(false);
    }
  }, [employeeId, employeeName, dateFrom, dateTo]);

  const buildCalendar = (): RegistroDia[] => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    // Usar data local para evitar bug UTC+ onde toISOString() retorna dia anterior
    const _n = new Date();
    const todayISO = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`;
    const grouped: Record<string, TimeRecord[]> = {};
    selectedEmployeeRecords.forEach(r => {
      if (!r.data_hora) return;
      const raw = r.data_hora.includes('T') ? r.data_hora.split('T')[0] : r.data_hora.split(' ')[0];
      if (!raw) return;
      const segs = raw.split('-');
      const key = segs[0].length === 4 ? raw : `${segs[2]}-${segs[1]}-${segs[0]}`;
      grouped[key] = grouped[key] || [];
      grouped[key].push(r);
    });
    const days: RegistroDia[] = [];
    for (let d = 1; d <= lastDay; d++) {
      // String formatting direto — sem conversão UTC
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const records = grouped[iso] || [];
      const dow = new Date(`${iso}T12:00:00`).getDay();
      const isPast = iso < todayISO;
      const feriadoNome = activeHolidayMap[iso];
      const isHoliday = Boolean(feriadoNome);
      const summary = dailySummaries[iso];

      // Expected minutes: backend summary is primary, local fallback for FALTA detection only.
      // Horário variável: nunca gera falta (sem jornada definida).
      // Falta (sem summary): usa jornada LÍQUIDA (com desconto de intervalo) = previsto real.
      const previstoMin = summary
        ? Number(summary.horas_previstas_min ?? 0)
        : minutosPrevistosDia(funcionarioSchedule, iso, true);
      const isWorkday = !isVariableSchedule && previstoMin > 0;

      // ── DIA EM PROCESSAMENTO — hoje nunca recebe status definitivo ──────────
      if (iso === todayISO) {
        days.push({
          data: iso, dia_numero: d,
          dia_semana: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][dow],
          feriado_nome: undefined, horas_previstas: undefined,
          entrada: summary?.hora_entrada || undefined,
          saida_intervalo: summary?.intervalo_saida || undefined,
          volta_intervalo: summary?.intervalo_volta || undefined,
          saida: summary?.hora_saida || undefined,
          horas_trabalhadas: undefined, horas_extras: undefined,
          atraso_min: undefined, saida_antecipada_min: undefined,
          horas_extras_min: undefined, feriado_credit_min: undefined,
          status: 'EM_PROCESSAMENTO', cor: 'cinza', registros: records,
        });
        continue;
      }

      // ── Status determinado EXCLUSIVAMENTE pelo dailySummary (fonte canônica) ──
      // rawRecords.length NUNCA é usado para determinar presença/falta.
      // summary.status vem do backend (PRESENTE | INCOMPLETO | VARIAVEL).
      const summaryStatus  = summary?.status as string | undefined;
      const summaryWorked  = summary ? Number(summary.horas_trabalhadas_min || 0) : 0;
      const summaryAtraso  = summary ? Number(summary.atraso_minutos || 0) : 0;
      const summaryNPunches = summary ? Number((summary as any).n_punches || 0) : 0;
      // Dia com batidas mas sem hora_saída → INCOMPLETO independente de summaryWorked
      const hasPunchNoExit = summaryNPunches > 0 && !summary?.hora_saida;

      let status: RegistroDia['status'] = 'SEM_REGISTRO';
      let cor: RegistroDia['cor'] = 'cinza';
      const atestadoUrl: string | undefined = (summary as any)?.atestado_url || undefined;
      if (summaryStatus === 'FERIAS') {
        status = 'FERIAS'; cor = 'azul';
      } else if (summaryStatus === 'ATESTADO') {
        status = 'ATESTADO'; cor = 'verde';
      } else if (isHoliday) {
        status = 'FERIADO';
        cor = 'azul';
      } else if (summaryStatus === 'INCOMPLETO' || hasPunchNoExit) {
        status = 'INCOMPLETO';
        cor = 'amarelo';
      } else if (summaryWorked > 0) {
        // Usa banco_horas_dia como fonte única de verdade para o status do dia.
        // banco < 0 → déficit real (entrada atrasada não compensada, saída antecipada, etc.)
        // banco >= 0 → jornada cumprida (inclusive quem chegou atrasado mas compensou)
        const bancoDia = summary ? Number((summary as any).banco_horas_dia ?? 0) : 0;
        if (bancoDia < 0) { status = 'ATRASO'; cor = 'laranja'; }
        else { status = 'PRESENTE'; cor = 'verde'; }
      } else if (isWorkday && isPast) {
        status = 'FALTA'; cor = 'vermelho';
      }

      // Crédito automático para feriados — APENAS jornada fixa.
      // Horário variável não tem carga diária: crédito automático não se aplica.
      const feriadoCreditMin = isHoliday && records.length === 0 && !isVariableSchedule
        ? minutosPrevistosDia(funcionarioSchedule, iso)
        : 0;

      const horasPrevisrasStr =
        (isWorkday && !isHoliday)
          ? (summary?.horas_previstas_str || toHHMM(previstoMin))
          : feriadoCreditMin > 0
            ? toHHMM(feriadoCreditMin)
            : undefined;

      days.push({
        data: iso,
        dia_numero: d,
        dia_semana: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][dow],
        feriado_nome: feriadoNome,
        horas_previstas: horasPrevisrasStr,
        entrada: summary?.hora_entrada || undefined,
        saida_intervalo: summary?.intervalo_saida || undefined,
        volta_intervalo: summary?.intervalo_volta || undefined,
        saida: summary?.hora_saida || undefined,
        horas_trabalhadas: summary?.horas_trabalhadas_str || undefined,
        horas_extras: summary?.banco_horas_dia_str || undefined,
        atraso_min: summary?.atraso_minutos,
        saida_antecipada_min: summary?.saida_antecipada_minutos,
        horas_extras_min: summary ? Number((summary as any).horas_extras_min ?? summary.horas_extras ?? 0) : undefined,
        feriado_credit_min: feriadoCreditMin > 0 ? feriadoCreditMin : undefined,
        atestado_url: atestadoUrl,
        status, cor, registros: records,
      });
    }
    return days;
  };

  const calendarDays = buildCalendar();
  // Inclui dias com registros reais OU days com status relevante via summary
  const diasTrabalhados = calendarDays.filter(d =>
    d.status === 'FERIAS' ||
    d.status === 'ATESTADO' ||
    d.registros.length > 0 ||
    d.status === 'INCOMPLETO' ||
    (dailySummaries[d.data] && Number(dailySummaries[d.data].horas_trabalhadas_min || 0) > 0)
  );
  const feriadosAutoCredit = calendarDays.filter(
    d => d.status === 'FERIADO' && (d.feriado_credit_min ?? 0) > 0 && d.registros.length === 0
  );
  // Dias de falta: dia útil passado sem registro — aparece na tabela para o gestor
  const _todayForFilter = (() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
  const diasFalta = calendarDays.filter(
    d => d.status === 'FALTA' && d.data < _todayForFilter
  );
  const allDisplayDays = [...diasTrabalhados, ...feriadosAutoCredit, ...diasFalta];
  const diasSorted = [...allDisplayDays].sort((a,b) => { const c=a.data.localeCompare(b.data); return sortDir==='asc'?c:-c; });

  const resumo = (() => {
    const _rt = new Date();
    const todayISO = `${_rt.getFullYear()}-${String(_rt.getMonth()+1).padStart(2,'0')}-${String(_rt.getDate()).padStart(2,'0')}`;

    let totalMinTrabalhados = 0;
    let totalMinPrevistos   = 0;
    let totalMinExtras      = 0;
    let totalMinAtrasos     = 0;

    Object.entries(dailySummaries).forEach(([iso, s]) => {
      if (iso >= todayISO) return; // hoje = EM_PROCESSAMENTO — não contabilizar
      totalMinTrabalhados += Number(s.horas_trabalhadas_min || 0);
      totalMinPrevistos   += Number(s.horas_previstas_min  || 0);
      totalMinExtras      += Number((s as any).horas_extras_min ?? (s as any).horas_extras ?? 0);
      totalMinAtrasos     += Number(s.atraso_minutos || 0) + Number((s as any).saida_antecipada_minutos || 0);
    });

    // Crédito automático de feriados — apenas jornada fixa
    if (!isVariableSchedule) {
      calendarDays.forEach(d => {
        if (d.status !== 'FERIADO') return;
        if (d.data >= todayISO) return; // hoje = EM_PROCESSAMENTO
        if (dailySummaries[d.data]) return;
        const credit = d.feriado_credit_min ?? 0;
        if (credit > 0) {
          totalMinTrabalhados += credit;
          totalMinPrevistos   += credit;
        }
      });
    }

    // Déficit de faltas no banco de horas — cada falta = -previstoMin no saldo
    if (!isVariableSchedule) {
      calendarDays.forEach(d => {
        if (d.status !== 'FALTA') return;
        if (d.data >= todayISO) return; // hoje = EM_PROCESSAMENTO
        const pMin = minutosPrevistosDia(funcionarioSchedule, d.data, true);
        if (pMin <= 0) return;
        totalMinPrevistos += pMin;
        totalMinAtrasos   += pMin;
      });
    }

    // Tolerância mensal
    const saldoBruto = totalMinExtras - totalMinAtrasos;
    const toleranciaAplicada = Math.abs(saldoBruto) <= MONTHLY_TOLERANCE_MIN;
    const saldoFinal         = toleranciaAplicada ? 0 : saldoBruto;
    const displayExtras      = toleranciaAplicada ? 0 : totalMinExtras;
    const displayAtrasos     = toleranciaAplicada ? 0 : totalMinAtrasos;
    // Só substitui trabalhado por previsto quando há previsto real (> 0).
    // Horário variável: previsto = 0 → sem substituição, exibe horas reais.
    const displayTrabalhado  = (toleranciaAplicada && totalMinPrevistos > 0)
      ? totalMinPrevistos
      : totalMinTrabalhados;

    const presentes = calendarDays.filter(d => {
      if (d.status === 'PRESENTE' || d.status === 'ATRASO' || d.status === 'INCOMPLETO') return true;
      if (d.status === 'FERIAS' || d.status === 'ATESTADO') return true;
      if (d.status === 'FERIADO' && d.data <= todayISO && (d.feriado_credit_min ?? 0) > 0) return true;
      return false;
    }).length;

    const faltas     = calendarDays.filter(d => d.status === 'FALTA').length;
    const atrasos    = calendarDays.filter(d => d.status === 'ATRASO').length;
    const incompletos = calendarDays.filter(d => d.status === 'INCOMPLETO').length;

    const diasUteisPrevistosAteHoje = calendarDays.filter(d => {
      if (d.data >= todayISO) return false; // hoje = EM_PROCESSAMENTO
      if (d.status === 'FERIADO') return (d.feriado_credit_min ?? 0) > 0;
      return !!(d.horas_previstas && d.horas_previstas !== '00:00');
    }).length;

    const cumprimento = Math.round((displayTrabalhado / (totalMinPrevistos || 1)) * 100);

    return {
      presentes, faltas, atrasos, incompletos,
      diasUteisTotais: diasUteisPrevistosAteHoje,
      percent: Math.round((presentes / (diasUteisPrevistosAteHoje || 1)) * 100),
      totalMinPrevistos,
      totalMinTrabalhados: displayTrabalhado,
      totalMinExtras: displayExtras,
      totalMinAtrasos: displayAtrasos,
      saldoMin: saldoFinal,
      toleranciaAplicada,
      cumprimento,
      previsto:   toHHMM(totalMinPrevistos),
      trabalhado: toHHMM(displayTrabalhado),
      extras:     toHHMM(displayExtras),
      atrasosStr: toHHMM(displayAtrasos),
      saldo:      toHHMM(saldoFinal),
    };
  })();

  const handleDeleteRecord = async () => {
    if (!recordToDelete||!invalidateJustificativa.trim()) return;
    setSubmitting(true);
    try { await apiService.invalidateTimeRecord(recordToDelete.registro_id, invalidateJustificativa.trim()); showSnackbar('Registro invalidado!', 'success'); setDeleteDialogOpen(false); setRecordToDelete(null); setInvalidateJustificativa(''); buscarRegistrosFuncionario(); }
    catch { showSnackbar('Erro ao invalidar', 'error'); } finally { setSubmitting(false); }
  };

  const handleAdjustClick = (record: TimeRecord) => {
    const tipo = (record.type||record.tipo||'entrada').toLowerCase();
    let date='', time='';
    if (record.data_hora) { const parts=record.data_hora.includes('T')?record.data_hora.split('T'):record.data_hora.split(' '); date=parts[0]||''; time=(parts[1]||'').substring(0,5); if (date.length===10&&date[2]==='-') { const [d,m,y]=date.split('-'); date=`${y}-${m}-${d}`; } }
    setRecordToAdjust(record);
    setAdjustData({ date, time, tipo: (tipo==='saida'||tipo==='saida')?'saida':'entrada', justificativa:'' });
    setAdjustDialogOpen(true);
  };

  // Adicionar novo registro manual
  const openAddRecord = (date?: string) => {
    const _d = new Date(); const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    setAddRecordData({ date: date || today, time: '', justificativa: '' });
    setAddRecordOpen(true);
  };

  const handleAddRecordConfirm = async () => {
    if (!employeeId || !addRecordData.justificativa.trim() || !addRecordData.date || !addRecordData.time) return;
    setAddRecordSubmitting(true);
    try {
      await apiService.registerTimeManual({
        employee_id: employeeId,
        data_hora: `${addRecordData.date} ${addRecordData.time}:00`,
        justificativa: addRecordData.justificativa.trim(),
      });
      showSnackbar('Registro adicionado!', 'success');
      setAddRecordOpen(false);
      setAddRecordData({ date: '', time: '', justificativa: '' });
      buscarRegistrosFuncionario();
    } catch (err: any) {
      showSnackbar(err?.response?.data?.error || 'Erro ao adicionar registro', 'error');
    } finally {
      setAddRecordSubmitting(false);
    }
  };

  // Badge visual: método de registro (câmera vs manual)
  const getMethodBadge = (method?: string, status?: string) => {
    const m = (method || '').toUpperCase();
    const isManual = m === 'MANUAL' || m === 'AJUSTE';
    const isAjuste = status === 'AJUSTADO' || m === 'AJUSTE';
    if (isAjuste) return (
      <Tooltip title="Ajuste manual">
        <Chip icon={<EditNoteIcon sx={{ fontSize: '11px !important' }} />} label="Ajuste" size="small"
          sx={{ height: 18, fontSize: 10, pl: 0.3, background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)', color: '#eab308', '& .MuiChip-icon': { color: '#eab308' } }} />
      </Tooltip>
    );
    if (isManual) return (
      <Tooltip title="Registro manual (admin)">
        <Chip icon={<EditNoteIcon sx={{ fontSize: '11px !important' }} />} label="Manual" size="small"
          sx={{ height: 18, fontSize: 10, pl: 0.3, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', '& .MuiChip-icon': { color: '#f59e0b' } }} />
      </Tooltip>
    );
    return (
      <Tooltip title="Registro automático (câmera/facial)">
        <Chip icon={<CameraIcon sx={{ fontSize: '11px !important' }} />} label="Auto" size="small"
          sx={{ height: 18, fontSize: 10, pl: 0.3, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: 'rgba(255,255,255,0.45)', '& .MuiChip-icon': { color: 'rgba(255,255,255,0.4)' } }} />
      </Tooltip>
    );
  };

  const handleAdjustConfirm = async () => {
    if (!recordToAdjust?.registro_id||!adjustData.justificativa.trim()||!adjustData.date||!adjustData.time) return;
    setSubmitting(true);
    try { await apiService.adjustTimeRecord(recordToAdjust.registro_id, { data_hora:`${adjustData.date} ${adjustData.time}:00`, justificativa: adjustData.justificativa.trim() }); showSnackbar('Registro ajustado!', 'success'); setAdjustDialogOpen(false); setRecordToAdjust(null); buscarRegistrosFuncionario(); }
    catch (err: any) { showSnackbar(err?.response?.data?.error||'Erro ao ajustar', 'error'); } finally { setSubmitting(false); }
  };

  const exportEmployeeHistory = () => {
    if (!selectedEmployee) return;
    const wb = XLSXStyle.utils.book_new();

    const COLS = ['A','B','C','D','E','F','G','H'];
    const pct = resumo.cumprimento;

    // ── Estilos preto e branco ──────────────────────────────────
    const bThin  = { style:'thin', color:{ rgb:'000000' } };
    const bThick = { style:'medium', color:{ rgb:'000000' } };
    const bAll   = { top: bThin, bottom: bThin, left: bThin, right: bThin };
    const bBox   = { top: bThick, bottom: bThick, left: bThick, right: bThick };
    const W      = { fgColor:{ rgb:'FFFFFF' } };
    const GRAY   = { fgColor:{ rgb:'D9D9D9' } };

    const sTitle = {
      font:{ bold:true, sz:14, color:{ rgb:'000000' } },
      fill: GRAY,
      alignment:{ horizontal:'left', vertical:'center', wrapText: true },
      border: bBox,
    };
    const sMeta = {
      font:{ sz:11, color:{ rgb:'000000' } },
      fill: W,
      alignment:{ horizontal:'left', vertical:'center' },
      border: bAll,
    };
    const sHdr = (left = false) => ({
      font:{ bold:true, sz:11, color:{ rgb:'000000' } },
      fill: GRAY,
      alignment:{ horizontal: left ? 'left' : 'center', vertical:'center', wrapText: true },
      border: bAll,
    });
    const sCell = (bold = false, left = false) => ({
      font:{ bold, sz:11, color:{ rgb:'000000' } },
      fill: W,
      alignment:{ horizontal: left ? 'left' : 'center', vertical:'center', wrapText: true },
      border: bAll,
    });
    const sResumo = (highlight: boolean) => ({
      font:{ bold:true, sz:11, color:{ rgb:'000000' } },
      fill: highlight ? { fgColor:{ rgb:'D9EAD3' } } : { fgColor:{ rgb:'FFFFFF' } },
      alignment:{ horizontal:'center', vertical:'center' },
      border: bAll,
    });
    const sEmpty = { font:{ sz:10 }, fill: W, border: bAll };

    // ── Dados ──────────────────────────────────────────────────
    const geradoEm = new Date().toLocaleString('pt-BR');
    const aoa: any[][] = [
      ['ESPELHO DE PONTO — ' + selectedEmployee.nome.toUpperCase(), '', '', '', '', '', '', ''],
      ['Período: ' + (dateFrom || '—') + ' a ' + (dateTo || '—'), '', '', '', '', '', '', ''],
      [`Gerado em: ${geradoEm}`, '', '', '', '', '', '', ''],
      ['Presentes', 'Faltas', 'H. Trabalhadas', 'H. Previstas', 'H. Extras', 'Atrasos', 'Banco de Horas', '% Cumprimento'],
      [resumo.presentes, resumo.faltas, resumo.trabalhado, resumo.previsto, resumo.extras, resumo.atrasosStr, resumo.saldo, pct + '%'],
      ['', '', '', '', '', '', '', ''],
      ['Data', 'Dia', 'Entrada', 'Saída Int.', 'Volta Int.', 'Saída', 'H. Trabalhadas', 'H. Previstas'],
    ];
    diasSorted.forEach(day => {
      if (day.status === 'FALTA') {
        aoa.push([
          day.data.split('-').reverse().join('-'),
          day.dia_semana.toUpperCase(),
          'FALTA', '', '', '', '00:00', day.horas_previstas || '-',
        ]);
      } else if (day.status === 'FERIADO' && day.registros.length === 0) {
        aoa.push([
          day.data.split('-').reverse().join('-'),
          day.dia_semana.toUpperCase(),
          `FERIADO${day.feriado_nome ? ': ' + day.feriado_nome : ''}`, '', '', '',
          day.horas_trabalhadas || toHHMM(day.feriado_credit_min ?? 0),
          day.horas_previstas || '-',
        ]);
      } else {
        aoa.push([
          day.data.split('-').reverse().join('-'),
          day.dia_semana.toUpperCase(),
          day.entrada || '-',
          day.saida_intervalo || '-',
          day.volta_intervalo || '-',
          day.saida || '-',
          day.horas_trabalhadas || '-',
          day.horas_previstas || '-',
        ]);
      }
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

    const styleRow = (r: number, fn: (ci: number) => any) =>
      COLS.forEach((c, ci) => { const ref = c + r; if (ws[ref]) ws[ref].s = fn(ci); });

    styleRow(1, () => sTitle);
    styleRow(2, () => sMeta);
    styleRow(3, () => sMeta);
    styleRow(4, (ci) => ci < 6 ? sHdr() : sEmpty);
    styleRow(5, (ci) => {
      if (ci === 6) return sResumo(resumo.saldoMin >= 0);
      if (ci === 7) return sCell(true);
      return sCell();
    });
    styleRow(6, () => sEmpty);
    styleRow(7, (ci) => sHdr(ci === 0 || ci === 1));
    diasSorted.forEach((_, ri) => {
      styleRow(8 + ri, (ci) => {
        if (ci === 0 || ci === 1) return sCell(false, true);
        if (ci === 6)             return sCell(true);
        return sCell();
      });
    });

    // Largura das colunas
    ws['!cols'] = [
      {wch:14}, // Data
      {wch:10}, // Dia
      {wch:12}, // Entrada
      {wch:13}, // Saída Int.
      {wch:13}, // Volta Int.
      {wch:12}, // Saída
      {wch:16}, // H. Trabalhadas
      {wch:16}, // H. Previstas
    ];
    ws['!merges'] = [
      { s:{ r:0, c:0 }, e:{ r:0, c:7 } },
      { s:{ r:1, c:0 }, e:{ r:1, c:7 } },
      { s:{ r:2, c:0 }, e:{ r:2, c:7 } },
      { s:{ r:6, c:0 }, e:{ r:6, c:7 } },
    ];
    // Configuração de impressão: paisagem, ajustar à largura da página
    (ws as any)['!pageSetup'] = {
      paperSize: 9,          // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printGridLines: false,
    };
    (ws as any)['!margins'] = { left:0.5, right:0.5, top:0.75, bottom:0.75, header:0.3, footer:0.3 };

    XLSXStyle.utils.book_append_sheet(wb, ws, 'Espelho');
    XLSXStyle.writeFile(wb, `Espelho-${selectedEmployee.nome}-${selectedMonth}.xlsx`);
    showSnackbar('Exportado!', 'success');
  };

  const scrollToDate = (iso: string) => {
    setExpandedDate(iso);
    const el = document.getElementById(`row-${iso}`);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  };

  useEffect(() => { if (employeeId) buscarRegistrosFuncionario(); }, [buscarRegistrosFuncionario]);

  // Carrega feriados ativos da empresa (inclui datas passadas) para o mês/ano selecionado.
  useEffect(() => {
    const loadActiveHolidays = async () => {
      if (!selectedMonth) {
        setActiveHolidayMap({});
        return;
      }
      try {
        const [year] = selectedMonth.split('-');
        const cfg = await apiService.get('/api/configuracoes');
        const uf = cfg?.empresa_uf || '';
        // Salvar weekly_schedule da empresa (usado no fallback de jornada)
        setCompanyWeeklySchedule(cfg?.weekly_schedule || null);
        if (cfg?.tolerancia_atraso !== undefined && cfg?.tolerancia_atraso !== null) {
          setToleranciaEmpresa(Number(cfg.tolerancia_atraso));
        }
        const resp = await apiService.get('/api/feriados', { ano: year, uf });
        const list = Array.isArray(resp) ? resp : [];
        const map: Record<string, string> = {};
        list.forEach((h: any) => {
          const ativo = h?.active !== false && h?.ativo !== false;
          const date = h?.date || h?.data;
          if (!ativo || !date) return;
          map[String(date)] = String(h?.name || h?.nome || 'Feriado');
        });
        setActiveHolidayMap(map);
      } catch {
        setActiveHolidayMap({});
      }
    };
    loadActiveHolidays();
  }, [selectedMonth]);

  // Buscar horário do funcionário
  useEffect(() => {
    if (!employeeId) return;
    apiService.getEmployee(employeeId).then((emp: any) => {
      const rawEntrada = emp?.horario_entrada;
      const rawSaida   = emp?.horario_saida;
      // Detectar horário variável antes de aplicar defaults
      setIsVariableSchedule(!rawEntrada || !rawSaida);
      const entrada = rawEntrada || '08:00';
      const saida   = rawSaida   || '17:00';
      // intervalo_padrao_minutos tem prioridade (0 é válido); fallback para legado
      const ipm = emp?.intervalo_padrao_minutos;
      const intervalo = (ipm !== undefined && ipm !== null)
        ? Number(ipm)
        : Number(emp?.intervalo_emp ?? emp?.duracao_intervalo ?? 60);
      setFuncionarioSchedule({ horario_entrada: entrada, horario_saida: saida, intervalo_min: intervalo });
      setCustomSchedule(emp?.custom_schedule || null);
      setCargaHorariaMensal(emp?.carga_horaria_mensal ? Number(emp.carga_horaria_mensal) : null);
    }).catch(() => {});
  }, [employeeId]);

  if (loading) return (<PageLayout><Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh"><CircularProgress sx={{ color:'white' }} /></Box></PageLayout>);

  return (
    <PageLayout>
      {/* HEADER */}
      <Box sx={{ mb: 4 }}>
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}>
          <Box sx={{ display:'flex', flexDirection:{ xs:'column', sm:'row' }, alignItems:{ sm:'center' }, justifyContent:'space-between', gap:2 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
              <IconButton onClick={() => navigate('/records')} sx={{ backgroundColor:'rgba(255,255,255,0.1)', color:'white', '&:hover':{ backgroundColor:'rgba(255,255,255,0.2)' } }}><ArrowBackIcon /></IconButton>
              <Box>
                <Typography variant="h4" sx={{ fontWeight:700, color:'white', fontSize:'28px' }}>{selectedEmployee?.nome || employeeName}</Typography>
                <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.6)', mt:0.5, textTransform:'capitalize' }}>Espelho de ponto</Typography>
              </Box>
            </Box>
            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
              <IconButton onClick={() => shiftMonth(-1)} sx={{ color:'white', backgroundColor:'rgba(255,255,255,0.08)', '&:hover':{ backgroundColor:'rgba(255,255,255,0.15)' } }}><ChevronLeftIcon /></IconButton>
              <Typography sx={{ color:'white', fontWeight:700, minWidth:160, textAlign:'center', textTransform:'capitalize' }}>{monthLabel()}</Typography>
              <IconButton onClick={() => shiftMonth(1)} sx={{ color:'white', backgroundColor:'rgba(255,255,255,0.08)', '&:hover':{ backgroundColor:'rgba(255,255,255,0.15)' } }}><ChevronRightIcon /></IconButton>
            </Box>
            <Box sx={{ display:'flex', gap:1.5 }}>
              <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} onClick={exportEmployeeHistory} disabled={diasTrabalhados.length===0} sx={{ borderColor:'rgba(255,255,255,0.3)', color:'rgba(255,255,255,0.8)', '&:hover':{ borderColor:'rgba(255,255,255,0.6)', background:'rgba(255,255,255,0.05)' } }}>Excel</Button>
            </Box>
          </Box>
        </motion.div>
      </Box>

      {/* CARDS RESUMO — 6 cards */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, delay:0.05 }}>
        <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr 1fr', md:'repeat(3,1fr)', xl:'repeat(6,1fr)' }, gap:2, mb:4 }}>
          {[
            {
              icon:<CheckCircleIcon sx={{ color:'#10b981', fontSize:28 }} />,
              label:'Presentes',
              value: isVariableSchedule
                ? `${resumo.presentes} dias`
                : `${resumo.presentes}/${resumo.diasUteisTotais || resumo.presentes} dias úteis`,
              sub:`${resumo.percent}% de presença`,
            },
            {
              icon:<CancelIcon sx={{ color: resumo.faltas > 0 ? '#ef4444' : 'rgba(255,255,255,0.35)', fontSize:28 }} />,
              label:'Faltas',
              value: isVariableSchedule
                ? <Typography variant="h5" sx={{ fontWeight:800, color:'rgba(255,255,255,0.3)' }}>—</Typography>
                : resumo.faltas > 0
                  ? `${resumo.faltas} falta${resumo.faltas > 1 ? 's' : ''}`
                  : 'Nenhuma falta',
              sub: isVariableSchedule
                ? 'Horário variável'
                : resumo.incompletos > 0
                  ? `⚠ ${resumo.incompletos} dia(s) incompleto(s)`
                  : resumo.atrasos > 0
                    ? `${resumo.atrasos} atraso(s)`
                    : 'Sem atrasos',
            },
            {
              icon:<AccessTimeIcon sx={{ color:'#3b82f6', fontSize:28 }} />,
              label:'Horas Trabalhadas',
              value: (
                <Typography variant="h5" sx={{ color:'white', fontWeight:800 }}>
                  {resumo.trabalhado}
                  {!isVariableSchedule && (
                    <Typography component="span" sx={{ color:'rgba(255,255,255,0.35)', fontWeight:400, fontSize:'0.78em' }}>
                      {' / '}{resumo.previsto}
                    </Typography>
                  )}
                </Typography>
              ),
              sub: isVariableSchedule ? 'Horas registradas' : `${resumo.cumprimento}% de cumprimento`,
            },
            {
              icon:<WarningIcon sx={{ color: isVariableSchedule ? 'rgba(255,255,255,0.3)' : (resumo.totalMinExtras > 0 ? '#a78bfa' : 'rgba(255,255,255,0.3)'), fontSize:28 }} />,
              label:'Horas Extras',
              value: isVariableSchedule
                ? <Typography variant="h5" sx={{ fontWeight:800, color:'rgba(255,255,255,0.3)' }}>—</Typography>
                : <Typography variant="h5" sx={{ fontWeight:800, color: resumo.totalMinExtras > 0 ? '#a78bfa' : 'rgba(255,255,255,0.45)' }}>{resumo.extras}</Typography>,
              sub: isVariableSchedule ? 'Horário variável' : 'Tempo excedente acumulado',
            },
            {
              icon:<WarningIcon sx={{ color: isVariableSchedule ? 'rgba(255,255,255,0.3)' : (resumo.totalMinAtrasos > 0 ? '#f59e0b' : 'rgba(255,255,255,0.3)'), fontSize:28 }} />,
              label:'Atrasos',
              value: isVariableSchedule
                ? <Typography variant="h5" sx={{ fontWeight:800, color:'rgba(255,255,255,0.3)' }}>—</Typography>
                : <Typography variant="h5" sx={{ fontWeight:800, color: resumo.totalMinAtrasos > 0 ? '#f59e0b' : 'rgba(255,255,255,0.45)' }}>{resumo.atrasosStr}</Typography>,
              sub: isVariableSchedule ? 'Horário variável' : 'Tempo abaixo da jornada',
            },
            {
              icon:<WarningIcon sx={{ color: isVariableSchedule ? 'rgba(255,255,255,0.3)' : (resumo.saldoMin > 0 ? '#10b981' : resumo.saldoMin < 0 ? '#ef4444' : 'rgba(255,255,255,0.3)'), fontSize:28 }} />,
              label: (
                <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                  <span>Banco de Horas</span>
                  <Tooltip title={
                    <Box sx={{ maxWidth:280 }}>
                      <Typography sx={{ fontSize:12, fontWeight:700, mb:0.5 }}>Como funciona o Banco de Horas</Typography>
                      <Typography sx={{ fontSize:11 }}>
                        Banco = Horas Extras − Atrasos acumulados no período.<br/><br/>
                        <strong>Tolerância mensal (2h):</strong> se o saldo absoluto for ≤ 2 horas, o sistema considera cumprimento integral — extras e atrasos são zerados no relatório. Isso evita penalizar flutuações mínimas.<br/><br/>
                        <strong>Positivo (+):</strong> funcionário trabalhou além da jornada.<br/>
                        <strong>Negativo (−):</strong> funcionário deve horas à empresa.
                      </Typography>
                    </Box>
                  } placement="top" arrow>
                    <InfoIcon sx={{ fontSize:14, color:'rgba(255,255,255,0.4)', cursor:'help', '&:hover':{ color:'rgba(255,255,255,0.7)' } }} />
                  </Tooltip>
                </Box>
              ),
              value: isVariableSchedule
                ? <Typography variant="h5" sx={{ fontWeight:800, color:'rgba(255,255,255,0.3)' }}>—</Typography>
                : (
                  <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                    <Typography variant="h5" sx={{ fontWeight:800, color: resumo.saldoMin > 0 ? '#10b981' : resumo.saldoMin < 0 ? '#ef4444' : 'rgba(255,255,255,0.45)' }}>
                      {resumo.saldoMin > 0 ? '+' : ''}{resumo.saldo}
                    </Typography>
                  </Box>
                ),
              sub: isVariableSchedule
                ? 'Horário variável'
                : resumo.toleranciaAplicada
                  ? '✓ Dentro da tolerância de 2h'
                  : resumo.saldoMin > 0 ? 'Saldo positivo acumulado' : resumo.saldoMin < 0 ? 'Saldo negativo acumulado' : 'Zerado',
            },
          ].map((card,i) => (
            <Card key={i} sx={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:2 }}>
              <CardContent sx={{ p:'20px !important' }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:1 }}>
                  {card.icon}
                  {typeof card.label === 'string'
                    ? <Typography sx={{ color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:600 }}>{card.label}</Typography>
                    : <Typography component="div" sx={{ color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:600 }}>{card.label}</Typography>
                  }
                </Box>
                {typeof card.value === 'string'
                  ? <Typography variant="h5" sx={{ color:'white', fontWeight:800 }}>{card.value}</Typography>
                  : card.value
                }
                <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.45)' }}>{card.sub}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </motion.div>

      {/* CALENDARIO */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, delay:0.1 }}>
        <Paper sx={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:2, p:3, mb:3 }}>
          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:2 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
              <CalendarIcon sx={{ color:'rgba(255,255,255,0.7)', fontSize:20 }} />
              <Typography sx={{ color:'rgba(255,255,255,0.9)', fontWeight:700, fontSize:15 }}>Calendário do Mês</Typography>
            </Box>
            {isVariableSchedule ? (
              <Typography sx={{ color:'rgba(255,255,255,0.45)', fontSize:12, fontStyle:'italic' }}>
                Horário variável
              </Typography>
            ) : (
              <Tooltip title={`Jornada líquida: ${toHHMM(minutosPrevistosDia(funcionarioSchedule))}h por dia`}>
                <Typography sx={{ color:'rgba(255,255,255,0.4)', fontSize:12, cursor:'default' }}>
                  Jornada: <strong style={{ color:'rgba(255,255,255,0.7)' }}>{funcionarioSchedule.horario_entrada} → {funcionarioSchedule.horario_saida}</strong>
                  &nbsp;|&nbsp;
                  Intervalo: <strong style={{ color:'rgba(255,255,255,0.7)' }}>{toHHMM(funcionarioSchedule.intervalo_min)}</strong>
                  &nbsp;|&nbsp;
                  Tolerância: <strong style={{ color:'rgba(255,255,255,0.7)' }}>{toleranciaEmpresa} min</strong>
                </Typography>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:0.5, mb:1 }}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map(d => (<Typography key={d} sx={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, py:0.5 }}>{d}</Typography>))}
          </Box>
          {(() => {
            if (!selectedMonth) return null;
            const [y,m] = selectedMonth.split('-').map(Number);
            const offset = new Date(y, m-1, 1).getDay();
            const cells: React.ReactNode[] = [];
            for (let i=0; i<offset; i++) cells.push(<Box key={`off-${i}`} />);
            calendarDays.forEach(day => {
              const { bg, border, color } = chipColor(day.status);
              cells.push(
                <Tooltip key={day.data} title={
                  day.status==='EM_PROCESSAMENTO'
                    ? `${formatDateTime(day.data).date}: Em processamento — aguardando consolidação`
                    : day.status==='FERIADO'
                    ? `${formatDateTime(day.data).date}: Feriado${day.feriado_nome ? ` - ${day.feriado_nome}` : ''}`
                    : (day.status==='PRESENTE' || day.status==='ATRASO')
                    ? `${formatDateTime(day.data).date}: ${day.horas_trabalhadas||'-'} trabalhado / ${day.horas_previstas||'-'} previsto (${day.status})`
                    : day.status==='FALTA'
                      ? `${formatDateTime(day.data).date}: FALTA`
                      : day.dia_semana
                }>
                  {/* temTrabalho: verdadeiro se há registros brutos OU summary calculado (hasSummaryOnly) */}
                  {(() => {
                    const isProcessing = day.status === 'EM_PROCESSAMENTO';
                    const temTrabalho = !isProcessing && (day.registros.length > 0 || day.status === 'PRESENTE' || day.status === 'ATRASO' || day.status === 'INCOMPLETO' || day.status === 'FERIAS' || day.status === 'ATESTADO');
                    return (
                      <Box
                        onClick={() => (temTrabalho || isProcessing) && day.registros.length > 0 ? scrollToDate(day.data) : undefined}
                        sx={{
                          py:1, px:0.5, borderRadius:1.5, textAlign:'center', minHeight:52,
                          cursor: (temTrabalho || (isProcessing && day.registros.length > 0)) ? 'pointer' : 'default',
                          background: isProcessing ? 'rgba(100,116,139,0.08)' : day.status==='FERIADO' ? 'rgba(250,204,21,0.12)' : temTrabalho ? bg : day.status==='FALTA' ? 'rgba(239,68,68,0.08)' : 'transparent',
                          border: `1px solid ${isProcessing ? 'rgba(100,116,139,0.28)' : day.status==='FERIADO' ? 'rgba(250,204,21,0.65)' : temTrabalho ? border : day.status==='FALTA' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)'}`,
                          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                          '&:hover': (temTrabalho || isProcessing) ? { opacity:0.85, transform:'scale(1.04)' } : {},
                        }}
                      >
                        <Typography sx={{ fontWeight:700, fontSize:13, color: isProcessing ? 'rgba(148,163,184,0.6)' : day.status==='FERIADO' ? '#facc15' : temTrabalho ? 'white' : day.status==='FALTA' ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.3)' }}>{day.dia_numero}</Typography>
                        {temTrabalho && <Typography sx={{ fontSize:10, color }}>{day.status==='PRESENTE'?'✓':day.status==='ATRASO'?'!':day.status==='INCOMPLETO'?'⚠':day.status==='FERIAS'?'🏖':day.status==='ATESTADO'?'🩺':''}</Typography>}
                        {day.status==='FERIADO' && <Typography sx={{ fontSize:10, color:'#facc15' }}>F</Typography>}
                        {day.status==='FALTA' && <Typography sx={{ fontSize:10, color:'rgba(239,68,68,0.7)' }}>✗</Typography>}
                        {isProcessing && <Typography sx={{ fontSize:10, color:'rgba(148,163,184,0.7)' }}>⏳</Typography>}
                      </Box>
                    );
                  })()}
                </Tooltip>
              );
            });
            return (
              <Box>
                <Box sx={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:0.5 }}>{cells}</Box>
                {/* Legenda */}
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:2, mt:2, pt:2, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    { symbol:'✓', color:'#10b981', label:'Presente' },
                    { symbol:'!', color:'#f59e0b', label:'Atraso' },
                    { symbol:'⚠', color:'#eab308', label:'Incompleto' },
                    { symbol:'F', color:'#facc15', label:'Feriado' },
                    { symbol:'✗', color:'#ef4444', label:'Falta' },
                    { symbol:'🏖', color:'#a78bfa', label:'Férias/Folga' },
                    { symbol:'🩺', color:'#2dd4bf', label:'Atestado' },
                    { symbol:'○', color:'rgba(255,255,255,0.3)', label:'Sem registro' },
                    { symbol:'⏳', color:'rgba(148,163,184,0.7)', label:'Em processamento' },
                  ].map(l => (
                    <Box key={l.label} sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                      <Typography sx={{ fontSize:11, color:l.color, fontWeight:700 }}>{l.symbol}</Typography>
                      <Typography sx={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{l.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}
        </Paper>
      </motion.div>

      {/* TABELA ESPELHO */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, delay:0.15 }}>
        <Paper sx={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:2, overflow:'hidden' }}>
          <Box sx={{ p:3, pb:2 }}>
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:2, flexWrap:'wrap', gap:2 }}>
              <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                <AccessTimeIcon sx={{ color:'rgba(255,255,255,0.7)', fontSize:20 }} />
                <Typography sx={{ color:'rgba(255,255,255,0.9)', fontWeight:700, fontSize:15 }}>
                  Registros do Mês
                  <Typography component="span" sx={{ color:'rgba(255,255,255,0.45)', fontSize:13, ml:1 }}>({diasSorted.length} dias)</Typography>
                </Typography>
              </Box>
              <Box sx={{ display:'flex', gap:1, alignItems:'center' }}>
                <Button size="small" startIcon={<AddIcon />} onClick={() => openAddRecord()}
                  sx={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.35)', color:'#60a5fa', fontWeight:700, fontSize:12, px:1.5, '&:hover':{ background:'rgba(59,130,246,0.25)' } }}>
                  Adicionar
                </Button>
                <TextField label="De" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); if (e.target.value&&dateTo) setSelectedMonth(getMonthFromDate(e.target.value)); }} size="small" InputLabelProps={{ shrink:true }} sx={{ width:140, ...dialogFieldSx }} />
                <TextField label="Ate" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); if (dateFrom&&e.target.value) setSelectedMonth(getMonthFromDate(e.target.value)); }} size="small" InputLabelProps={{ shrink:true }} sx={{ width:140, ...dialogFieldSx }} />
                <IconButton onClick={() => { const c=getCurrentMonth(); setSelectedMonth(c); setDateFrom(getFirstDayOfMonth(c)); setDateTo(getLastDayOfMonth(c)); }} size="small" sx={{ color:'rgba(255,255,255,0.6)' }}><ClearIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
          </Box>
          <Box sx={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)' }} />
          <TableContainer sx={{ background:'transparent' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Data','Entrada','Saída Int.','Volta Int.','Saída','Trabalhado','Previsto','Banco Horas',''].map((h,i) => (
                    <TableCell key={i} align={i===0?'left':'center'} sx={{ fontWeight:700, color:'rgba(255,255,255,0.7)', fontSize:11, textTransform:'uppercase', letterSpacing:0.4, borderBottom:'1px solid rgba(255,255,255,0.1)', py:1.5, px:i===0?2:1, whiteSpace:'nowrap' }}>
                      {i===0 ? <TableSortLabel active direction={sortDir} onClick={() => setSortDir(p => p==='asc'?'desc':'asc')} sx={{ color:'rgba(255,255,255,0.7) !important', '& .MuiTableSortLabel-icon':{ color:'rgba(255,255,255,0.4) !important' } }}>{h}</TableSortLabel> : h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {diasSorted.length===0 ? (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py:8, border:'none' }}>
                    <AccessTimeIcon sx={{ color:'rgba(255,255,255,0.3)', fontSize:48, mb:2, display:'block', mx:'auto' }} />
                    <Typography sx={{ color:'rgba(255,255,255,0.5)', fontSize:16, fontWeight:600 }}>Nenhum registro neste período</Typography>
                    <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.35)', mt:0.5 }}>Ajuste o mês ou o intervalo de datas</Typography>
                  </TableCell></TableRow>
                ) : diasSorted.map(day => {
                  const { date } = formatDateTime(day.data);
                  const { bg, border, color } = chipColor(day.status);
                  const isOpen = expandedDate===day.data;
                  const isFeriadoAutoCredit = day.status === 'FERIADO' && (day.feriado_credit_min ?? 0) > 0 && day.registros.length === 0;

                  // ── Linha EM_PROCESSAMENTO — dia atual, sem cálculos definitivos ─
                  if (day.status === 'EM_PROCESSAMENTO') {
                    return (
                      <React.Fragment key={day.data}>
                        <TableRow sx={{ borderLeft:'3px solid rgba(100,116,139,0.5)', background:'rgba(100,116,139,0.04)', '& td':{ borderBottom:'1px solid rgba(255,255,255,0.06)' } }}>
                          <TableCell sx={{ py:1, px:2 }}>
                            <Typography sx={{ fontWeight:700, color:'rgba(148,163,184,0.85)', fontSize:12, whiteSpace:'nowrap' }}>{day.data.split('-').reverse().join('-')}</Typography>
                            <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.35)', textTransform:'uppercase', fontSize:10 }}>{day.dia_semana}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{color:'rgba(255,255,255,0.6)',fontSize:12,fontFamily:'monospace'}}>{day.entrada||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{color:'rgba(255,255,255,0.4)',fontSize:12,fontFamily:'monospace'}}>{day.saida_intervalo||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{color:'rgba(255,255,255,0.4)',fontSize:12,fontFamily:'monospace'}}>{day.volta_intervalo||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{color:'rgba(255,255,255,0.6)',fontSize:12,fontFamily:'monospace'}}>{day.saida||'—'}</Typography></TableCell>
                          <TableCell align="center" colSpan={3}>
                            <Chip label="⏳ Em processamento" size="small" sx={{ height:20, fontSize:11, background:'rgba(100,116,139,0.12)', border:'1px solid rgba(100,116,139,0.4)', color:'rgba(148,163,184,0.9)', fontWeight:600 }} />
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </React.Fragment>
                    );
                  }

                  // ── Linha de FALTA ────────────────────────────────────────────
                  if (day.status === 'FALTA') {
                    return (
                      <React.Fragment key={day.data}>
                        <TableRow sx={{ borderLeft:'3px solid #ef4444', background:'rgba(239,68,68,0.04)', '& td':{ borderBottom:'1px solid rgba(255,255,255,0.06)' } }}>
                          <TableCell sx={{ py:1, px:2 }}>
                            <Typography sx={{ fontWeight:700, color:'rgba(239,68,68,0.85)', fontSize:12, whiteSpace:'nowrap' }}>{day.data.split('-').reverse().join('-')}</Typography>
                            <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontSize:10 }}>{day.dia_semana}</Typography>
                          </TableCell>
                          <TableCell align="center" colSpan={6}>
                            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1 }}>
                              <Chip label="Falta" size="small" sx={{ height:18, fontSize:10, background:'rgba(239,68,68,0.18)', border:'1px solid rgba(239,68,68,0.5)', color:'#ef4444', fontWeight:700 }} />
                              <Typography sx={{ color:'rgba(239,68,68,0.6)', fontSize:11 }}>Sem registro de ponto</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Typography sx={{ fontSize:12, fontFamily:'monospace', color:'#ef4444', fontWeight:700 }}>
                              {day.horas_previstas ? `-${day.horas_previstas}` : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </React.Fragment>
                    );
                  }

                  // ── Linha de feriado com crédito automático ──────────────────
                  if (isFeriadoAutoCredit) {
                    return (
                      <React.Fragment key={day.data}>
                        <TableRow sx={{ borderLeft:'3px solid #eab308', background:'rgba(234,179,8,0.05)', '& td':{ borderBottom:'1px solid rgba(255,255,255,0.06)' } }}>
                          <TableCell sx={{ py:1, px:2 }}>
                            <Typography sx={{ fontWeight:700, color:'white', fontSize:12, whiteSpace:'nowrap' }}>{day.data.split('-').reverse().join('-')}</Typography>
                            <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontSize:10 }}>{day.dia_semana}</Typography>
                          </TableCell>
                          <TableCell align="center" colSpan={4}>
                            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1 }}>
                              <Chip label="Feriado" size="small" sx={{ height:18, fontSize:10, background:'rgba(234,179,8,0.2)', border:'1px solid rgba(234,179,8,0.5)', color:'#eab308', fontWeight:700 }} />
                              {day.feriado_nome && <Typography sx={{ color:'rgba(234,179,8,0.8)', fontSize:11 }}>{day.feriado_nome}</Typography>}
                            </Box>
                          </TableCell>
                          <TableCell align="center"><Typography sx={{ fontWeight:700, fontSize:12, fontFamily:'monospace', color:'white' }}>{toHHMM(day.feriado_credit_min!)}</Typography></TableCell>
                          <TableCell align="center"><Typography sx={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.5)' }}>{toHHMM(day.feriado_credit_min!)}</Typography></TableCell>
                          <TableCell align="center"><Typography sx={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.4)' }}>00:00</Typography></TableCell>
                          <TableCell />
                        </TableRow>
                      </React.Fragment>
                    );
                  }

                  // ── Linha de FÉRIAS / FOLGA ──────────────────────────────
                  if (day.status === 'FERIAS') {
                    const s = dailySummaries[day.data] || {};
                    return (
                      <React.Fragment key={day.data}>
                        <TableRow sx={{ borderLeft:'3px solid #8b5cf6', background:'rgba(139,92,246,0.06)', '& td':{ borderBottom:'1px solid rgba(255,255,255,0.06)' } }}>
                          <TableCell sx={{ py:1, px:2 }}>
                            <Typography sx={{ fontWeight:700, color:'white', fontSize:12, whiteSpace:'nowrap' }}>{day.data.split('-').reverse().join('-')}</Typography>
                            <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontSize:10 }}>{day.dia_semana}</Typography>
                          </TableCell>
                          <TableCell align="center" colSpan={4}>
                            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1 }}>
                              <Chip label="🏖 Férias / Folga" size="small" sx={{ height:20, fontSize:11, background:'rgba(139,92,246,0.2)', border:'1px solid rgba(139,92,246,0.5)', color:'#a78bfa', fontWeight:700 }} />
                            </Box>
                          </TableCell>
                          <TableCell align="center"><Typography sx={{ fontWeight:700, fontSize:12, fontFamily:'monospace', color:'#a78bfa' }}>{s.horas_trabalhadas_str || day.horas_previstas || '—'}</Typography></TableCell>
                          <TableCell align="center"><Typography sx={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.5)' }}>{s.horas_previstas_str || day.horas_previstas || '—'}</Typography></TableCell>
                          <TableCell align="center"><Typography sx={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.4)' }}>00:00</Typography></TableCell>
                          <TableCell />
                        </TableRow>
                      </React.Fragment>
                    );
                  }

                  // ── Linha de ATESTADO ─────────────────────────────────────
                  if (day.status === 'ATESTADO') {
                    const s = dailySummaries[day.data] || {};
                    return (
                      <React.Fragment key={day.data}>
                        <TableRow sx={{ borderLeft:'3px solid #14b8a6', background:'rgba(20,184,166,0.06)', '& td':{ borderBottom:'1px solid rgba(255,255,255,0.06)' } }}>
                          <TableCell sx={{ py:1, px:2 }}>
                            <Typography sx={{ fontWeight:700, color:'white', fontSize:12, whiteSpace:'nowrap' }}>{day.data.split('-').reverse().join('-')}</Typography>
                            <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontSize:10 }}>{day.dia_semana}</Typography>
                          </TableCell>
                          <TableCell align="center" colSpan={4}>
                            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1 }}>
                              <Chip
                                label="🩺 Atestado Médico"
                                size="small"
                                onClick={day.atestado_url ? () => window.open(day.atestado_url, '_blank') : undefined}
                                sx={{
                                  height:20, fontSize:11, fontWeight:700,
                                  background:'rgba(20,184,166,0.2)', border:'1px solid rgba(20,184,166,0.5)', color:'#2dd4bf',
                                  cursor: day.atestado_url ? 'pointer' : 'default',
                                  '&:hover': day.atestado_url ? { background:'rgba(20,184,166,0.35)', transform:'scale(1.03)' } : {},
                                  transition:'all 0.15s',
                                }}
                              />
                              {day.atestado_url && (
                                <Typography sx={{ fontSize:10, color:'rgba(45,212,191,0.7)', textDecoration:'underline', cursor:'pointer' }}
                                  onClick={() => window.open(day.atestado_url, '_blank')}>
                                  Ver documento
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center"><Typography sx={{ fontWeight:700, fontSize:12, fontFamily:'monospace', color:'#2dd4bf' }}>{s.horas_trabalhadas_str || day.horas_previstas || '—'}</Typography></TableCell>
                          <TableCell align="center"><Typography sx={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.5)' }}>{s.horas_previstas_str || day.horas_previstas || '—'}</Typography></TableCell>
                          <TableCell align="center"><Typography sx={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.4)' }}>00:00</Typography></TableCell>
                          <TableCell />
                        </TableRow>
                      </React.Fragment>
                    );
                  }

                  // ── Linha com summary mas sem raw records ─────────────────
                  const hasSummaryOnly = day.registros.length === 0 && (
                    day.status === 'INCOMPLETO' ||
                    (dailySummaries[day.data] && Number(dailySummaries[day.data].horas_trabalhadas_min || 0) > 0)
                  );
                  if (hasSummaryOnly) {
                    const s = dailySummaries[day.data] || {};
                    const isIncomp = day.status === 'INCOMPLETO';
                    const leftColor = isIncomp ? '#eab308' : '#10b981';
                    return (
                      <React.Fragment key={day.data}>
                        <TableRow sx={{ borderLeft:`3px solid ${leftColor}`, background: isIncomp ? 'rgba(234,179,8,0.04)' : 'rgba(16,185,129,0.04)', '& td':{ borderBottom:'1px solid rgba(255,255,255,0.06)' } }}>
                          <TableCell sx={{ py:1, px:2 }}>
                            <Typography sx={{ fontWeight:700, color:'white', fontSize:12, whiteSpace:'nowrap' }}>{day.data.split('-').reverse().join('-')}</Typography>
                            <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontSize:10 }}>
                              {day.dia_semana}
                              {isIncomp && <span style={{ color:'#eab308', marginLeft:4 }}>⚠ incompleto</span>}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{color:'rgba(255,255,255,0.85)',fontSize:12,fontFamily:'monospace'}}>{s.hora_entrada||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{color:'rgba(255,255,255,0.4)',fontSize:12,fontFamily:'monospace'}}>{s.intervalo_saida||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{color:'rgba(255,255,255,0.4)',fontSize:12,fontFamily:'monospace'}}>{s.intervalo_volta||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{color:'rgba(255,255,255,0.85)',fontSize:12,fontFamily:'monospace'}}>{s.hora_saida||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{fontWeight:700,fontSize:12,fontFamily:'monospace',color:'white'}}>{s.horas_trabalhadas_str||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{fontSize:12,fontFamily:'monospace',color:'rgba(255,255,255,0.5)'}}>{s.horas_previstas_str||'—'}</Typography></TableCell>
                          <TableCell align="center" sx={{py:1,px:1}}><Typography sx={{fontSize:12,fontFamily:'monospace',fontWeight:700,color:Number(s.banco_horas_dia??0)>=0?'#10b981':'#ef4444'}}>{s.banco_horas_dia_str||'00:00'}</Typography></TableCell>
                          <TableCell />
                        </TableRow>
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={day.data}>
                      <TableRow id={`row-${day.data}`} hover onClick={() => setExpandedDate(isOpen?null:day.data)} sx={{ cursor:'pointer', borderLeft:`3px solid ${border}`, '& td':{ borderBottom: isOpen?'none':'1px solid rgba(255,255,255,0.06)' }, background:isOpen?'rgba(255,255,255,0.04)':'transparent' }}>
                        {/* Data + Dia */}
                        <TableCell sx={{ py:1, px:2 }}>
                          <Typography sx={{ fontWeight:700, color:'white', fontSize:12, whiteSpace:'nowrap' }}>{day.data.split('-').reverse().join('-')}</Typography>
                          <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontSize:10 }}>
                            {day.dia_semana}
                            {day.status === 'INCOMPLETO' && <span style={{ color:'#eab308', marginLeft:4 }}>⚠ incompleto</span>}
                          </Typography>
                        </TableCell>
                        {/* Entrada */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><Typography sx={{ color:'rgba(255,255,255,0.85)', fontSize:12, fontFamily:'monospace' }}>{day.entrada||'—'}</Typography></TableCell>
                        {/* Saída Int. */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><Typography sx={{ color:day.saida_intervalo?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.3)', fontSize:12, fontFamily:'monospace' }}>{day.saida_intervalo||'—'}</Typography></TableCell>
                        {/* Volta Int. */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><Typography sx={{ color:day.volta_intervalo?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.3)', fontSize:12, fontFamily:'monospace' }}>{day.volta_intervalo||'—'}</Typography></TableCell>
                        {/* Saída */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><Typography sx={{ color:'rgba(255,255,255,0.85)', fontSize:12, fontFamily:'monospace' }}>{day.saida||'—'}</Typography></TableCell>
                        {/* Trabalhado */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><Typography sx={{ fontWeight:700, fontSize:12, fontFamily:'monospace', color:'white' }}>{day.horas_trabalhadas||'—'}</Typography></TableCell>
                        {/* Previsto */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><Typography sx={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.5)' }}>{day.horas_previstas||'—'}</Typography></TableCell>
                        {/* Banco de Horas */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><Typography sx={{ fontSize:12, fontFamily:'monospace', color: day.horas_extras ? (day.horas_extras.startsWith('-') ? '#ef4444' : '#10b981') : 'rgba(255,255,255,0.5)', fontWeight:700 }}>{day.horas_extras||'00:00'}</Typography></TableCell>
                        {/* Expand */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><IconButton size="small" sx={{ color:'rgba(255,255,255,0.5)', p:0.5 }}>{isOpen?<ExpandMoreIcon sx={{ fontSize:18 }} />:<ExpandLessIcon sx={{ fontSize:18 }} />}</IconButton></TableCell>
                      </TableRow>
                      <TableRow>
                          <TableCell colSpan={9} sx={{ p:0, borderBottom:isOpen?'1px solid rgba(255,255,255,0.06)':'none' }}>
                          <Collapse in={isOpen} timeout="auto" unmountOnExit>
                            <Box sx={{ background:'rgba(0,0,0,0.15)', px:4, py:2 }}>
                              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
                                <Typography sx={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>
                  Marcações — {day.registros.filter(r => !['INVALIDADO','AJUSTADO'].includes((r as any).status||'ATIVO')).length} ativo(s){day.registros.some(r => ['INVALIDADO','AJUSTADO'].includes((r as any).status||'')) ? ` · ${day.registros.filter(r => ['INVALIDADO','AJUSTADO'].includes((r as any).status||'')).length} invalidado(s)` : ''}
                </Typography>
                                <Button size="small" startIcon={<AddIcon sx={{ fontSize:14 }} />} onClick={e => { e.stopPropagation(); openAddRecord(day.data); }}
                                  sx={{ color:'#60a5fa', fontSize:11, px:1, py:0.25, minHeight:0, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)', '&:hover':{ background:'rgba(59,130,246,0.2)' } }}>
                                  + Registro
                                </Button>
                              </Box>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>{['Hora','Fonte','Tipo','Status','Justificativa','Ações'].map(h => (<TableCell key={h} sx={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, borderBottom:'1px solid rgba(255,255,255,0.08)', py:0.5 }}>{h}</TableCell>))}</TableRow>
                                </TableHead>
                                <TableBody>
                                  {(() => {
                                    // Pré-calcular posição entre registros ATIVOS do dia
                                    const activeRecs = day.registros
                                      .filter(rec => !['INVALIDADO','AJUSTADO'].includes((rec as any).status||'ATIVO'))
                                      .sort((a,b) => (a.data_hora||'') < (b.data_hora||'') ? -1 : 1);
                                    const n = activeRecs.length;
                                    const LABELS_BY_N: Record<number,string[]> = {
                                      1: ['Entrada'],
                                      2: ['Entrada','Saída'],
                                      3: ['Entrada','Saída Intervalo','Saída'],
                                      4: ['Entrada','Saída Intervalo','Volta Intervalo','Saída'],
                                    };
                                    const labels = LABELS_BY_N[Math.min(n,4)] ?? LABELS_BY_N[4];
                                    return day.registros.map((r,idx) => {
                                    const { time }=formatDateTime(r.data_hora||'');
                                    const recStatus=(r as any).status||'ATIVO';
                                    const isInactive=recStatus==='INVALIDADO'||recStatus==='AJUSTADO';
                                    const sCol=recStatus==='INVALIDADO'?'#ef4444':recStatus==='AJUSTADO'?'#f59e0b':'#10b981';
                                    // Tipo inferido por posição; inativos usam tipo armazenado
                                    let tipoLabel: string;
                                    let tipoEntry: boolean;
                                    if (isInactive) {
                                      const rt=(r.type||r.tipo||'entrada').toLowerCase();
                                      tipoLabel=getStatusText(rt); tipoEntry=rt==='entrada'||rt==='retorno_almoco';
                                    } else {
                                      const ai=activeRecs.findIndex(rec=>rec.registro_id===r.registro_id||(rec.data_hora===r.data_hora&&rec.registro_id===r.registro_id));
                                      const safeIdx=ai>=0?ai:activeRecs.findIndex(rec=>rec.data_hora===r.data_hora);
                                      tipoLabel=labels[safeIdx]??(safeIdx%2===0?'Entrada':'Saída');
                                      tipoEntry=tipoLabel==='Entrada'||tipoLabel==='Volta Intervalo';
                                    }
                                    const invalidadoPor = (r as any).invalidado_por || (r as any).ajustado_por || '';
                                    const invalidadoEm  = (r as any).invalidado_em  || (r as any).ajustado_em  || '';
                                    const invalidadoEmFmt = invalidadoEm ? (() => { try { return new Date(invalidadoEm).toLocaleString('pt-BR'); } catch { return invalidadoEm; } })() : '';
                                    return (
                                      <TableRow key={r.registro_id||idx} sx={{ '& td':{ borderBottom:'none' }, opacity: isInactive ? 0.6 : 1, background: isInactive ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                                        <TableCell sx={{ color: isInactive ? 'rgba(255,255,255,0.4)' : 'white', fontFamily:'monospace', fontSize:13, textDecoration: isInactive ? 'line-through' : 'none' }}>{time}</TableCell>
                                        <TableCell>{getMethodBadge((r as any).method, recStatus)}</TableCell>
                                        <TableCell><Chip label={tipoLabel} size="small" sx={{ background: isInactive ? 'rgba(255,255,255,0.06)' : undefined, color: isInactive ? 'rgba(255,255,255,0.35)' : undefined }} color={isInactive ? undefined : (tipoEntry?'success':'error')} /></TableCell>
                                        <TableCell>
                                          <Box sx={{ display:'flex', flexDirection:'column', gap:0.25 }}>
                                            <Chip label={recStatus} size="small" onClick={e => { if ((r as any).justificativa&&isInactive) { setJustificativaTexto((r as any).justificativa); setJustificativaAnchorEl(e.currentTarget); } }} sx={{ background:`${sCol}22`, border:`1px solid ${sCol}`, color:sCol, fontWeight:700, fontSize:11, cursor:isInactive&&(r as any).justificativa?'pointer':'default', alignSelf:'flex-start' }} />
                                            {isInactive && invalidadoPor && (
                                              <Typography sx={{ fontSize:10, color:'rgba(255,255,255,0.3)', lineHeight:1.2 }}>
                                                por {invalidadoPor}{invalidadoEmFmt ? ` · ${invalidadoEmFmt}` : ''}
                                              </Typography>
                                            )}
                                          </Box>
                                        </TableCell>
                                        <TableCell sx={{ color:'rgba(255,255,255,0.5)', fontSize:12, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(r as any).justificativa||'—'}</TableCell>
                                        <TableCell>
                                          <Box sx={{ display:'flex', gap:0.5 }}>
                                            <Tooltip title="Ajustar"><span><IconButton size="small" disabled={isInactive||!r.registro_id} onClick={() => handleAdjustClick(r)} sx={{ color:isInactive?'rgba(255,255,255,0.15)':'#3b82f6' }}><EditIcon sx={{ fontSize:16 }} /></IconButton></span></Tooltip>
                                            <Tooltip title="Invalidar"><span><IconButton size="small" disabled={isInactive||!r.registro_id} onClick={() => { setRecordToDelete(r); setInvalidateJustificativa(''); setDeleteDialogOpen(true); }} sx={{ color:isInactive?'rgba(255,255,255,0.15)':'#ef4444' }}><BlockIcon sx={{ fontSize:16 }} /></IconButton></span></Tooltip>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  });
                                  })()}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </motion.div>

      {/* POPOVER */}
      <Popover open={Boolean(justificativaAnchorEl)} anchorEl={justificativaAnchorEl} onClose={() => setJustificativaAnchorEl(null)} anchorOrigin={{ vertical:'bottom', horizontal:'left' }} transformOrigin={{ vertical:'top', horizontal:'left' }} PaperProps={{ sx:{ p:2, maxWidth:320, background:'rgba(15,23,42,0.97)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:2 } }}>
        <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>Justificativa</Typography>
        <Typography variant="body2" sx={{ color:'white', mt:0.5 }}>{justificativaTexto}</Typography>
      </Popover>

      {/* DIALOG INVALIDAR */}
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setInvalidateJustificativa(''); }} PaperProps={{ sx:{ borderRadius:2, background:'rgba(15,23,42,0.97)', border:'1px solid rgba(255,255,255,0.1)', color:'white' } }}>
        <DialogTitle sx={{ fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:1 }}>
          <BlockIcon sx={{ color:'#ef4444', fontSize:20 }} />
          Invalidar Registro
        </DialogTitle>
        <DialogContent>
          {recordToDelete && (() => {
            const { date, time } = formatDateTime(recordToDelete.data_hora || '');
            const tipo = getStatusText(recordToDelete.type || recordToDelete.tipo || 'entrada');
            const dateKey = (recordToDelete.data_hora || '').includes('T')
              ? recordToDelete.data_hora!.split('T')[0]
              : (recordToDelete.data_hora || '').split(' ')[0];
            const rawKey = dateKey.split('-').length === 3 && dateKey.split('-')[0].length === 2
              ? `${dateKey.split('-')[2]}-${dateKey.split('-')[1]}-${dateKey.split('-')[0]}`
              : dateKey;
            const summary = dailySummaries[rawKey] || dailySummaries[dateKey];
            const bancoDia = summary ? Number(summary.banco_horas_dia ?? 0) : null;
            return (
              <Box>
                <Box sx={{ p:1.5, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:1.5, mb:2 }}>
                  <Typography sx={{ color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:600, mb:0.5 }}>Registro a invalidar:</Typography>
                  <Typography sx={{ color:'rgba(255,255,255,0.6)', fontSize:12 }}>
                    {date} às {time} — <span style={{ color:'#f59e0b' }}>{tipo}</span>
                  </Typography>
                  {bancoDia !== null && (
                    <Typography sx={{ color:'rgba(255,255,255,0.5)', fontSize:11, mt:0.5 }}>
                      Banco de horas do dia: <strong style={{ color: bancoDia >= 0 ? '#10b981' : '#ef4444' }}>{bancoDia >= 0 ? '+' : ''}{toHHMM(bancoDia)}</strong>
                      <span style={{ color:'rgba(255,255,255,0.35)', marginLeft:4 }}>(será recalculado após invalidação)</span>
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ color:'rgba(255,255,255,0.6)', mb:2, fontSize:13 }}>
                  O registro ficará marcado como <strong style={{ color:'#ef4444' }}>INVALIDADO</strong> — não é excluído e pode ser auditado depois.
                </Typography>
                <TextField fullWidth label="Justificativa *" placeholder="Motivo da invalidação" value={invalidateJustificativa} onChange={e => setInvalidateJustificativa(e.target.value)} multiline rows={3} sx={dialogFieldSx} />
              </Box>
            );
          })()}
          {!recordToDelete && <TextField fullWidth label="Justificativa *" placeholder="Motivo da invalidação" value={invalidateJustificativa} onChange={e => setInvalidateJustificativa(e.target.value)} multiline rows={3} sx={dialogFieldSx} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setInvalidateJustificativa(''); }} disabled={submitting} sx={{ color:'rgba(255,255,255,0.6)' }}>Cancelar</Button>
          <Button onClick={handleDeleteRecord} color="error" variant="contained" disabled={submitting||!invalidateJustificativa.trim()} startIcon={submitting?<CircularProgress size={18} color="inherit" />:<BlockIcon />}>{submitting?'Invalidando...':'Invalidar'}</Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG AJUSTAR */}
      <Dialog open={adjustDialogOpen} onClose={() => !submitting&&setAdjustDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:2, background:'rgba(15,23,42,0.97)', border:'1px solid rgba(255,255,255,0.1)', color:'white' } }}>
        <DialogTitle sx={{ fontWeight:700, color:'white' }}>Ajustar Registro</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.6)', mb:2 }}>O original ficara marcado como AJUSTADO e sera criado um novo registro.</Typography>
          <Box sx={{ display:'flex', flexDirection:'column', gap:2, mt:1 }}>
            <Box sx={{ display:'flex', gap:2 }}>
              <TextField label="Nova Data" type="date" value={adjustData.date} onChange={e => setAdjustData(p => ({...p,date:e.target.value}))} InputLabelProps={{ shrink:true }} sx={{ flex:1,...dialogFieldSx }} />
              <TextField label="Horario" type="time" value={adjustData.time} onChange={e => setAdjustData(p => ({...p,time:e.target.value}))} InputLabelProps={{ shrink:true }} sx={{ flex:1,...dialogFieldSx }} />
            </Box>
            <TextField fullWidth label="Justificativa *" placeholder="Motivo do ajuste" value={adjustData.justificativa} onChange={e => setAdjustData(p => ({...p,justificativa:e.target.value}))} multiline rows={3} sx={dialogFieldSx} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustDialogOpen(false)} disabled={submitting} sx={{ color:'rgba(255,255,255,0.6)' }}>Cancelar</Button>
          <Button onClick={handleAdjustConfirm} variant="contained" disabled={submitting||!adjustData.justificativa.trim()||!adjustData.date||!adjustData.time} sx={{ background:'#2563eb','&:hover':{ background:'#1d4ed8' } }}>{submitting?'Ajustando...':'Confirmar'}</Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG ADICIONAR REGISTRO */}
      <Dialog open={addRecordOpen} onClose={() => !addRecordSubmitting && setAddRecordOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx:{ borderRadius:2, background:'rgba(15,23,42,0.97)', border:'1px solid rgba(255,255,255,0.1)', color:'white' } }}>
        <DialogTitle sx={{ fontWeight:700, color:'white', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <AddIcon sx={{ fontSize:20, color:'#60a5fa' }} />
            Adicionar Registro
          </Box>
          <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.5)', fontWeight:400 }}>
            {selectedEmployee?.nome || employeeName}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.6)', mb:2 }}>
            Registro manual — ficará marcado como <strong style={{ color:'#f59e0b' }}>Manual</strong> para auditoria.
          </Typography>
          <Box sx={{ display:'flex', flexDirection:'column', gap:2, mt:1 }}>
            <Box sx={{ display:'flex', gap:2 }}>
              <TextField label="Data" type="date" value={addRecordData.date}
                onChange={e => setAddRecordData(p => ({...p, date: e.target.value}))}
                InputLabelProps={{ shrink:true }} sx={{ flex:1, ...dialogFieldSx }} />
              <TextField label="Horário" type="time" value={addRecordData.time}
                onChange={e => setAddRecordData(p => ({...p, time: e.target.value}))}
                InputLabelProps={{ shrink:true }}
                sx={{ flex:1, ...dialogFieldSx }} />
            </Box>
            <TextField label="Justificativa *" placeholder="Motivo do registro manual"
              value={addRecordData.justificativa}
              onChange={e => setAddRecordData(p => ({...p, justificativa: e.target.value}))}
              multiline rows={3} sx={dialogFieldSx} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRecordOpen(false)} disabled={addRecordSubmitting} sx={{ color:'rgba(255,255,255,0.6)' }}>Cancelar</Button>
          <Button onClick={handleAddRecordConfirm} variant="contained" disabled={addRecordSubmitting || !addRecordData.justificativa.trim() || !addRecordData.date || !addRecordData.time}
            startIcon={addRecordSubmitting ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            sx={{ background:'#2563eb','&:hover':{ background:'#1d4ed8' } }}>
            {addRecordSubmitting ? 'Salvando...' : 'Adicionar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical:'bottom', horizontal:'right' }} sx={{ zIndex:9999 }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width:'100%' }}>{snackbarMessage}</Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default EmployeeRecordsPage;
