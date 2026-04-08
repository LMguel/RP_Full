import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Email as EmailIcon,
  FileDownload as FileDownloadIcon,
  AccessTime as AccessTimeIcon,
  Close as CloseIcon,
  Clear as ClearIcon,
  CalendarMonth as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Tooltip, Popover } from '@mui/material';
import { motion } from 'framer-motion';
import XLSXStyle from 'xlsx-js-style';
import { apiService } from '../services/api';
import { TimeRecord, Employee } from '../types';

interface EmployeeWithRecords extends Employee {
  registros?: TimeRecord[];
  totalHoras?: string;
  ultimoRegistro?: TimeRecord;
}

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
  horas_extras?: string;
  status: 'PRESENTE' | 'FALTA' | 'ATRASO' | 'FERIADO' | 'SEM_REGISTRO';
  cor: 'verde' | 'vermelho' | 'laranja' | 'azul' | 'cinza';
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

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithRecords | null>(null);
  const [selectedEmployeeRecords, setSelectedEmployeeRecords] = useState<TimeRecord[]>([]);
  const [summaryExtraMinutes, setSummaryExtraMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<TimeRecord | null>(null);
  const [invalidateJustificativa, setInvalidateJustificativa] = useState('');
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [recordToAdjust, setRecordToAdjust] = useState<TimeRecord | null>(null);
  const [adjustData, setAdjustData] = useState({ date: '', time: '', tipo: 'entrada' as 'entrada' | 'saida', justificativa: '' });
  const [justificativaAnchorEl, setJustificativaAnchorEl] = useState<HTMLElement | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [emailEnviando, setEmailEnviando] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [activeHolidayMap, setActiveHolidayMap] = useState<Record<string, string>>({});

  // Horário do funcionário (buscado da API)
  const [funcionarioSchedule, setFuncionarioSchedule] = useState<{
    horario_entrada: string;
    horario_saida: string;
    intervalo_min: number;
  }>({ horario_entrada: '08:00', horario_saida: '17:00', intervalo_min: 60 });

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

  // Calcula os minutos previstos por dia com base no horário do funcionário
  const minutosPrevistosDia = (schedule: typeof funcionarioSchedule): number => {
    const parseHHMM = (s: string) => { const [h,m] = s.split(':').map(Number); return h*60+(m||0); };
    const entrada = parseHHMM(schedule.horario_entrada);
    const saida = parseHHMM(schedule.horario_saida);
    return Math.max(0, saida - entrada - schedule.intervalo_min);
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

  const calcularTotalHoras = (registros: TimeRecord[]): string => {
    let total = 0; let entrada: Date | null = null;
    [...registros].sort((a,b) => parseDataHora(a.data_hora||'').getTime()-parseDataHora(b.data_hora||'').getTime()).forEach(r => {
      const tipo = (r.type||r.tipo||'').toLowerCase(); const dt = parseDataHora(r.data_hora||'');
      if (tipo==='entrada') { entrada=dt; }
      else if ((['saida','saída','saida_final'].includes(tipo)) && entrada) { total += (dt.getTime()-entrada.getTime())/1000; entrada=null; }
    });
    const h = Math.floor(total/3600); const min = Math.floor((total%3600)/60);
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  };

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
    const labels: Record<string,string> = { entrada: 'Entrada', saida: 'Saida', 'saída': 'Saida', intervalo_inicio: 'Saida Intervalo', intervalo_fim: 'Volta Intervalo', retorno: 'Volta Intervalo', saida_antecipada: 'Saida Antecipada' };
    return labels[tipo.toLowerCase()] || tipo;
  };

  const chipColor = (status: string) => {
    if (status==='PRESENTE') return { bg:'rgba(16,185,129,0.15)', border:'#10b981', color:'#10b981' };
    if (status==='ATRASO') return { bg:'rgba(245,158,11,0.15)', border:'#f59e0b', color:'#f59e0b' };
    if (status==='FERIADO') return { bg:'rgba(250,204,21,0.2)', border:'#facc15', color:'#facc15' };
    if (status==='FALTA') return { bg:'rgba(239,68,68,0.15)', border:'#ef4444', color:'#ef4444' };
    return { bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.5)' };
  };

  const buscarRegistrosFuncionario = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const params: any = { funcionario_id: employeeId, employee_id: employeeId };
      if (dateFrom) params.inicio = dateFrom;
      if (dateTo) params.fim = dateTo;
      const response = await apiService.getTimeRecords(params);
      const records: TimeRecord[] = Array.isArray(response) ? response : [];
      const sorted = [...records].sort((a,b) => parseDataHora(a.data_hora||'').getTime()-parseDataHora(b.data_hora||'').getTime());
      setSelectedEmployeeRecords(sorted);
      setSelectedEmployee({ id: employeeId, nome: employeeName||'Funcionario', cargo:'', foto_url:'', face_id:'', empresa_nome:'', empresa_id:'', data_cadastro: new Date().toISOString(), registros: sorted, totalHoras: calcularTotalHoras(sorted), ultimoRegistro: sorted[sorted.length-1] });

      // Mantem o valor de hora extra idêntico ao exibido na coluna de RecordsPage.
      const summaryResponse = await apiService.getTimeRecordsSummary(params);
      const summaryList = Array.isArray(summaryResponse) ? summaryResponse : [];
      const summaryItem = summaryList.find((item: any) => {
        const id = String(item?.funcionario_id ?? item?.employee_id ?? '');
        return id === String(employeeId);
      }) || summaryList[0] || null;
      const toNumber = (value: any): number => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        if (typeof value === 'string') {
          const parsed = parseFloat(value.replace(',', '.'));
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };
      const parseHHMMToMinutes = (val: any): number => {
        if (typeof val === 'string' && /^\d{1,3}:\d{2}$/.test(val)) {
          const [h, m] = val.split(':').map(Number);
          return h * 60 + m;
        }
        return 0;
      };
      const horasExtrasMin = summaryItem?.horas_extras_minutos != null
        ? toNumber(summaryItem.horas_extras_minutos)
        : parseHHMMToMinutes(summaryItem?.horas_extras);
      setSummaryExtraMinutes(horasExtrasMin);
    } catch {
      setSummaryExtraMinutes(0);
      showSnackbar('Erro ao carregar historico', 'error');
    }
    finally { setLoading(false); }
  }, [employeeId, employeeName, dateFrom, dateTo]);

  const buildCalendar = (): RegistroDia[] => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const todayISO = new Date().toISOString().slice(0,10);
    const minPrevistos = minutosPrevistosDia(funcionarioSchedule);
    const grouped: Record<string,TimeRecord[]> = {};
    selectedEmployeeRecords.forEach(r => {
      if (!r.data_hora) return;
      const raw = r.data_hora.includes('T') ? r.data_hora.split('T')[0] : r.data_hora.split(' ')[0];
      if (!raw) return;
      // Backend retorna DD-MM-YYYY; normalizar para YYYY-MM-DD
      const segs = raw.split('-');
      const key = segs[0].length === 4 ? raw : `${segs[2]}-${segs[1]}-${segs[0]}`;
      grouped[key] = grouped[key] || [];
      grouped[key].push(r);
    });
    const days: RegistroDia[] = [];
    for (let d=1; d<=lastDay; d++) {
      const dateObj = new Date(year, month-1, d);
      const iso = dateObj.toISOString().slice(0,10);
      const records = grouped[iso] || [];
      const dow = dateObj.getDay(); // 0=Dom, 6=Sab
      const isWeekday = dow >= 1 && dow <= 5;
      const isPast = iso <= todayISO;
      const feriadoNome = activeHolidayMap[iso];
      const isHoliday = Boolean(feriadoNome);
      let status: RegistroDia['status'] = 'SEM_REGISTRO';
      let cor: RegistroDia['cor'] = 'cinza';
      if (isHoliday) {
        status = 'FERIADO';
        cor = 'azul';
      } else if (records.length > 0) {
        const hasAtraso = records.some(r => (r.atraso_minutos||0) > 0);
        if (hasAtraso) { status='ATRASO'; cor='laranja'; } else { status='PRESENTE'; cor='verde'; }
      } else if (isWeekday && isPast) {
        status='FALTA'; cor='vermelho';
      }
      const entRec = records.find(r => (r.type||r.tipo||'').toLowerCase()==='entrada');
      const saiIntRec = records.find(r => ['intervalo_inicio','saida_intervalo','intervalo_saida'].includes((r.type||r.tipo||'').toLowerCase()));
      const voltaIntRec = records.find(r => ['intervalo_fim','volta_intervalo','retorno','intervalo_volta'].includes((r.type||r.tipo||'').toLowerCase()));
      const saiRec = [...records].reverse().find(r => ['saida','saída','saida_final','saída_final','checkout'].includes((r.type||r.tipo||'').toLowerCase()));
      const horasPrevisvasStr = isWeekday && !isHoliday ? toHHMM(minPrevistos) : undefined;
      // Calcula horas trabalhadas descontando intervalo quando não há registros explícitos de intervalo
      let horasTrabalhadasStr: string | undefined = undefined;
      let horasExtrasStr: string | undefined = undefined;
      if (records.length) {
        const rawStr = calcularTotalHoras(records);
        const [rh, rm] = rawStr.split(':').map(Number);
        const rawMin = rh * 60 + (rm || 0);
        const hasIntervalRecords = !!(saiIntRec || voltaIntRec);
        const finalMin = hasIntervalRecords ? rawMin : Math.max(0, rawMin - funcionarioSchedule.intervalo_min);
        horasTrabalhadasStr = toHHMM(finalMin);

        const minutosExtrasDia = records.reduce((acc, r) => {
          const extraMin = Number((r as any).horas_extras_minutos || 0);
          return acc + (Number.isFinite(extraMin) ? extraMin : 0);
        }, 0);
        horasExtrasStr = toHHMM(Math.max(0, minutosExtrasDia));
      }
      days.push({
        data: iso,
        dia_numero: d,
        dia_semana: ['dom','seg','ter','qua','qui','sex','sab'][dow],
        feriado_nome: feriadoNome,
        horas_previstas: horasPrevisvasStr,
        entrada: entRec ? formatDateTime(entRec.data_hora||'').time : undefined,
        saida_intervalo: saiIntRec ? formatDateTime(saiIntRec.data_hora||'').time : undefined,
        volta_intervalo: voltaIntRec ? formatDateTime(voltaIntRec.data_hora||'').time : undefined,
        saida: saiRec ? formatDateTime(saiRec.data_hora||'').time : undefined,
        horas_trabalhadas: horasTrabalhadasStr,
        horas_extras: horasExtrasStr,
        status, cor, registros: records
      });
    }
    return days;
  };

  const calendarDays = buildCalendar();
  const diasTrabalhados = calendarDays.filter(d => d.registros.length > 0);
  const diasSorted = [...diasTrabalhados].sort((a,b) => { const c=a.data.localeCompare(b.data); return sortDir==='asc'?c:-c; });

  const resumo = (() => {
    const todayISO = new Date().toISOString().slice(0,10);
    const presentes = calendarDays.filter(d => d.status==='PRESENTE'||d.status==='ATRASO').length;
    const faltas = calendarDays.filter(d => d.status==='FALTA').length;
    const atrasos = calendarDays.filter(d => d.status==='ATRASO').length;
    const minutosExtras = summaryExtraMinutes;
    // Dias úteis passados ou hoje no mês = dias previstos
    const diasUteisPrevistosAteHoje = calendarDays.filter(d => {
      const dow = new Date(d.data+'T12:00:00').getDay();
      return dow >= 1 && dow <= 5 && d.data <= todayISO && d.status !== 'FERIADO';
    }).length;
    const minPrevistos = minutosPrevistosDia(funcionarioSchedule);
    const totalMinPrevistos = diasUteisPrevistosAteHoje * minPrevistos;
    // Horas trabalhadas reais: soma das horas de cada dia
    const totalMinTrabalhados = diasTrabalhados.reduce((acc, day) => {
      if (day.status === 'FERIADO') return acc;
      if (!day.horas_trabalhadas) return acc;
      const [h,m] = day.horas_trabalhadas.split(':').map(Number);
      return acc + h*60 + (m||0);
    }, 0);
    const saldoMin = totalMinTrabalhados - totalMinPrevistos;
    return {
      presentes, faltas, atrasos,
      totalMinExtras: minutosExtras,
      horas_extras: toHHMM(minutosExtras),
      totalHoras: selectedEmployee?.totalHoras||'00:00',
      percent: Math.round((presentes/(diasUteisPrevistosAteHoje||1))*100),
      totalMinPrevistos,
      totalMinTrabalhados,
      saldoMin,
      previsto: toHHMM(totalMinPrevistos),
      trabalhado: toHHMM(totalMinTrabalhados),
      saldo: toHHMM(saldoMin),
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

  const handleAdjustConfirm = async () => {
    if (!recordToAdjust?.registro_id||!adjustData.justificativa.trim()||!adjustData.date||!adjustData.time) return;
    setSubmitting(true);
    try { await apiService.adjustTimeRecord(recordToAdjust.registro_id, { data_hora:`${adjustData.date} ${adjustData.time}:00`, tipo: adjustData.tipo as any, justificativa: adjustData.justificativa.trim() }); showSnackbar('Registro ajustado!', 'success'); setAdjustDialogOpen(false); setRecordToAdjust(null); buscarRegistrosFuncionario(); }
    catch (err: any) { showSnackbar(err?.response?.data?.error||'Erro ao ajustar', 'error'); } finally { setSubmitting(false); }
  };

  const exportEmployeeHistory = () => {
    if (!selectedEmployee) return;
    const wb = XLSXStyle.utils.book_new();

    const COLS = ['A','B','C','D','E','F','G','H'];
    const pct = Math.round((resumo.totalMinTrabalhados / (resumo.totalMinPrevistos || 1)) * 100);

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
    const aoa: any[][] = [
      ['ESPELHO DE PONTO — ' + selectedEmployee.nome.toUpperCase(), '', '', '', '', '', '', ''],
      ['Período: ' + (dateFrom || '—') + ' a ' + (dateTo || '—'), '', '', '', '', '', '', ''],
      ['Dias Trabalhados', 'Faltas', 'H. Trabalhadas', 'H. Previstas', 'Hora Extra', '% de Cumprimento', '', ''],
      [resumo.presentes, resumo.faltas, resumo.trabalhado, resumo.previsto, resumo.horas_extras, pct + '%', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['Data', 'Dia', 'Entrada', 'Saída Int.', 'Volta Int.', 'Saída', 'H. Trabalhadas', 'H. Previstas'],
    ];
    diasSorted.forEach(day => aoa.push([
      day.data.split('-').reverse().join('-'),
      day.dia_semana.toUpperCase(),
      day.entrada || '-',
      day.saida_intervalo || '-',
      day.volta_intervalo || '-',
      day.saida || '-',
      day.horas_trabalhadas || '-',
      day.horas_previstas || '-',
    ]));

    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

    const styleRow = (r: number, fn: (ci: number) => any) =>
      COLS.forEach((c, ci) => { const ref = c + r; if (ws[ref]) ws[ref].s = fn(ci); });

    styleRow(1, () => sTitle);
    styleRow(2, () => sMeta);
    styleRow(3, (ci) => ci < 6 ? sHdr() : sEmpty);
    styleRow(4, (ci) => {
      if (ci === 4) return sResumo(resumo.totalMinExtras > 0);
      if (ci === 5) return sCell(true);
      if (ci >= 6)  return sEmpty;
      return sCell();
    });
    styleRow(5, () => sEmpty);
    styleRow(6, (ci) => sHdr(ci === 0 || ci === 1));
    diasSorted.forEach((_, ri) => {
      styleRow(7 + ri, (ci) => {
        if (ci === 0 || ci === 1) return sCell(false, true);
        if (ci === 6)             return sCell(true);
        return sCell();
      });
    });

    // Largura das colunas — todas generosas para impressão
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
      { s:{ r:4, c:0 }, e:{ r:4, c:7 } },
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

  const enviarPorEmail = async () => {
    if (!emailDestino||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) { showSnackbar('Email invalido','error'); return; }
    setEmailEnviando(true);
    try { await new Promise(r=>setTimeout(r,1500)); showSnackbar('Enviado!','success'); setEmailDialogOpen(false); setEmailDestino(''); }
    catch { showSnackbar('Erro ao enviar','error'); } finally { setEmailEnviando(false); }
  };

  const scrollToDate = (iso: string) => {
    setExpandedDate(iso);
    const el = document.getElementById(`row-${iso}`);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  };

  useEffect(() => { const c=getCurrentMonth(); setSelectedMonth(c); setDateFrom(getFirstDayOfMonth(c)); setDateTo(getLastDayOfMonth(c)); }, []);
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
      const entrada = emp?.horario_entrada || '08:00';
      const saida   = emp?.horario_saida   || '17:00';
      const intervalo = Number(emp?.intervalo_emp ?? emp?.duracao_intervalo ?? 60);
      setFuncionarioSchedule({ horario_entrada: entrada, horario_saida: saida, intervalo_min: intervalo });
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
              <Button variant="outlined" size="small" startIcon={<EmailIcon />} onClick={() => setEmailDialogOpen(true)} disabled={diasTrabalhados.length===0} sx={{ borderColor:'rgba(255,255,255,0.3)', color:'rgba(255,255,255,0.8)', '&:hover':{ borderColor:'rgba(255,255,255,0.6)', background:'rgba(255,255,255,0.05)' } }}>Enviar</Button>
            </Box>
          </Box>
        </motion.div>
      </Box>

      {/* CARDS RESUMO */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, delay:0.05 }}>
        <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr 1fr', sm:'repeat(4,1fr)' }, gap:2, mb:4 }}>
          {[
            { icon:<CheckCircleIcon sx={{ color:'#10b981', fontSize:28 }} />, label:'Presentes', value:`${resumo.presentes} dias`, sub:`${resumo.percent}% dos dias úteis` },
            { icon:<CancelIcon sx={{ color:'#ef4444', fontSize:28 }} />, label:'Faltas', value:`${resumo.faltas} dias`, sub: resumo.atrasos>0?`${resumo.atrasos} atraso(s)`:'Sem faltas' },
            {
              icon:<AccessTimeIcon sx={{ color:'#3b82f6', fontSize:28 }} />,
              label:'Horas Trabalhadas',
              value: (
                <Box>
                  <Typography variant="h5" sx={{ color:'white', fontWeight:800 }}>{resumo.trabalhado}</Typography>
                  <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>
                    de {resumo.previsto} previsto
                  </Typography>
                </Box>
              ),
              sub: `${Math.round((resumo.totalMinTrabalhados/(resumo.totalMinPrevistos||1))*100)}% de cumprimento`,
            },
            {
              icon: <WarningIcon sx={{ color: resumo.totalMinExtras > 0 ? '#10b981' : 'rgba(255,255,255,0.55)', fontSize:28 }} />,
              label: 'Hora Extra',
              value: (
                <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                  <Typography variant="h5" sx={{ fontWeight:800, color: resumo.totalMinExtras > 0 ? '#10b981' : 'rgba(255,255,255,0.85)' }}>
                    {resumo.horas_extras}
                  </Typography>
                </Box>
              ),
              sub: 'Total acumulado no período',
            },
          ].map((card,i) => (
            <Card key={i} sx={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:2 }}>
              <CardContent sx={{ p:'20px !important' }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:1 }}>{card.icon}<Typography sx={{ color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:600 }}>{card.label}</Typography></Box>
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
            <Tooltip title={`Horário: ${funcionarioSchedule.horario_entrada} – ${funcionarioSchedule.horario_saida} (intervalo ${funcionarioSchedule.intervalo_min}min)`}>
              <Typography sx={{ color:'rgba(255,255,255,0.4)', fontSize:12, cursor:'default' }}>
                Jornada diária: <strong style={{ color:'rgba(255,255,255,0.7)' }}>{toHHMM(minutosPrevistosDia(funcionarioSchedule))}h</strong>
                &nbsp;|&nbsp;
                {funcionarioSchedule.horario_entrada} → {funcionarioSchedule.horario_saida} (-{funcionarioSchedule.intervalo_min}min intervalo)
              </Typography>
            </Tooltip>
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
                  day.status==='FERIADO'
                    ? `${formatDateTime(day.data).date}: Feriado${day.feriado_nome ? ` - ${day.feriado_nome}` : ''}`
                    : day.registros.length > 0
                    ? `${formatDateTime(day.data).date}: ${day.horas_trabalhadas||'-'} trabalhado / ${day.horas_previstas||'-'} previsto (${day.status})`
                    : day.status==='FALTA'
                      ? `${formatDateTime(day.data).date}: FALTA`
                      : day.dia_semana
                }>
                  <Box onClick={() => day.registros.length > 0 ? scrollToDate(day.data) : undefined} sx={{ py:1, px:0.5, borderRadius:1.5, textAlign:'center', minHeight:52, cursor:day.registros.length>0?'pointer':'default', background:day.status==='FERIADO'?'rgba(250,204,21,0.12)':day.registros.length>0?bg:day.status==='FALTA'?'rgba(239,68,68,0.08)':'transparent', border:`1px solid ${day.status==='FERIADO'?'rgba(250,204,21,0.65)':day.registros.length>0?border:day.status==='FALTA'?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.05)'}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', transition:'all 0.15s', '&:hover': day.registros.length>0?{ opacity:0.85, transform:'scale(1.04)' }:{} }}>
                    <Typography sx={{ fontWeight:700, color:day.status==='FERIADO'?'#facc15':day.registros.length>0?'white':day.status==='FALTA'?'rgba(239,68,68,0.7)':'rgba(255,255,255,0.3)', fontSize:13 }}>{day.dia_numero}</Typography>
                    {day.registros.length > 0 && <Typography sx={{ fontSize:10, color }}>{day.status==='PRESENTE'?'✓':day.status==='ATRASO'?'!':''}</Typography>}
                    {day.status==='FERIADO' && <Typography sx={{ fontSize:10, color:'#facc15' }}>F</Typography>}
                    {day.status==='FALTA' && <Typography sx={{ fontSize:10, color:'rgba(239,68,68,0.7)' }}>✗</Typography>}
                  </Box>
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
                    { symbol:'F', color:'#facc15', label:'Feriado' },
                    { symbol:'✗', color:'#ef4444', label:'Falta' },
                    { symbol:'○', color:'rgba(255,255,255,0.3)', label:'Sem registro' },
                    { symbol:'Dom', color:'rgba(255,255,255,0.25)', label:'Domingo / Sábado' },
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
                  Registros do Mes
                  <Typography component="span" sx={{ color:'rgba(255,255,255,0.45)', fontSize:13, ml:1 }}>({diasTrabalhados.length} dias com registro)</Typography>
                </Typography>
              </Box>
              <Box sx={{ display:'flex', gap:1, alignItems:'center' }}>
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
                  {['Data','Entrada','Saída Int.','Volta Int.','Saída','Trabalhado','Previsto','Hora Extra',''].map((h,i) => (
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
                    <Typography sx={{ color:'rgba(255,255,255,0.5)', fontSize:16, fontWeight:600 }}>Nenhum registro neste periodo</Typography>
                    <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.35)', mt:0.5 }}>Ajuste o mes ou o intervalo de datas</Typography>
                  </TableCell></TableRow>
                ) : diasSorted.map(day => {
                  const { date } = formatDateTime(day.data);
                  const { bg, border, color } = chipColor(day.status);
                  const isOpen = expandedDate===day.data;
                  return (
                    <React.Fragment key={day.data}>
                      <TableRow id={`row-${day.data}`} hover onClick={() => setExpandedDate(isOpen?null:day.data)} sx={{ cursor:'pointer', borderLeft:`3px solid ${border}`, '& td':{ borderBottom: isOpen?'none':'1px solid rgba(255,255,255,0.06)' }, background:isOpen?'rgba(255,255,255,0.04)':'transparent' }}>
                        {/* Data + Dia */}
                        <TableCell sx={{ py:1, px:2 }}>
                          <Typography sx={{ fontWeight:700, color:'white', fontSize:12, whiteSpace:'nowrap' }}>{day.data.split('-').reverse().join('-')}</Typography>
                          <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontSize:10 }}>{day.dia_semana}</Typography>
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
                        {/* Hora Extra */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><Typography sx={{ fontSize:12, fontFamily:'monospace', color:day.horas_extras&&day.horas_extras!=='00:00'?'#10b981':'rgba(255,255,255,0.5)', fontWeight:700 }}>{day.horas_extras||'00:00'}</Typography></TableCell>
                        {/* Expand */}
                        <TableCell align="center" sx={{ py:1, px:1 }}><IconButton size="small" sx={{ color:'rgba(255,255,255,0.5)', p:0.5 }}>{isOpen?<ExpandMoreIcon sx={{ fontSize:18 }} />:<ExpandLessIcon sx={{ fontSize:18 }} />}</IconButton></TableCell>
                      </TableRow>
                      <TableRow>
                          <TableCell colSpan={9} sx={{ p:0, borderBottom:isOpen?'1px solid rgba(255,255,255,0.06)':'none' }}>
                          <Collapse in={isOpen} timeout="auto" unmountOnExit>
                            <Box sx={{ background:'rgba(0,0,0,0.15)', px:4, py:2 }}>
                              <Typography sx={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, mb:1, textTransform:'uppercase', letterSpacing:1 }}>Marcacoes — {day.registros.length} registro(s)</Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>{['Hora','Tipo','Status','Justificativa','Acoes'].map(h => (<TableCell key={h} sx={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, borderBottom:'1px solid rgba(255,255,255,0.08)', py:0.5 }}>{h}</TableCell>))}</TableRow>
                                </TableHead>
                                <TableBody>
                                  {day.registros.map((r,idx) => {
                                    const { time }=formatDateTime(r.data_hora||'');
                                    const recStatus=(r as any).status||'ATIVO';
                                    const isInactive=recStatus==='INVALIDADO'||recStatus==='AJUSTADO';
                                    const sCol=recStatus==='INVALIDADO'?'#ef4444':recStatus==='AJUSTADO'?'#f59e0b':'#10b981';
                                    return (
                                      <TableRow key={r.registro_id||idx} sx={{ '& td':{ borderBottom:'none' } }}>
                                        <TableCell sx={{ color:'white', fontFamily:'monospace', fontSize:13 }}>{time}</TableCell>
                                        <TableCell><Chip label={getStatusText(r.type||r.tipo||'entrada')} size="small" color={(r.type||r.tipo||'')==='entrada'?'success':'error'} /></TableCell>
                                        <TableCell><Chip label={recStatus} size="small" onClick={e => { if ((r as any).justificativa&&isInactive) { setJustificativaTexto((r as any).justificativa); setJustificativaAnchorEl(e.currentTarget); } }} sx={{ background:`${sCol}22`, border:`1px solid ${sCol}`, color:sCol, fontWeight:700, fontSize:11, cursor:isInactive?'pointer':'default' }} /></TableCell>
                                        <TableCell sx={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}>{(r as any).justificativa||'—'}</TableCell>
                                        <TableCell>
                                          <Box sx={{ display:'flex', gap:0.5 }}>
                                            <Tooltip title="Ajustar"><span><IconButton size="small" disabled={isInactive||!r.registro_id} onClick={() => handleAdjustClick(r)} sx={{ color:isInactive?'rgba(255,255,255,0.15)':'#3b82f6' }}><EditIcon sx={{ fontSize:16 }} /></IconButton></span></Tooltip>
                                            <Tooltip title="Invalidar"><span><IconButton size="small" disabled={isInactive||!r.registro_id} onClick={() => { setRecordToDelete(r); setInvalidateJustificativa(''); setDeleteDialogOpen(true); }} sx={{ color:isInactive?'rgba(255,255,255,0.15)':'#ef4444' }}><BlockIcon sx={{ fontSize:16 }} /></IconButton></span></Tooltip>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
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
        <DialogTitle sx={{ fontWeight:700, color:'white' }}>Invalidar Registro</DialogTitle>
        <DialogContent>
          <Typography sx={{ color:'rgba(255,255,255,0.7)', mb:2 }}>O registro sera marcado como <strong>INVALIDADO</strong>, nao excluido.</Typography>
          <TextField fullWidth label="Justificativa *" placeholder="Motivo da invalidacao" value={invalidateJustificativa} onChange={e => setInvalidateJustificativa(e.target.value)} multiline rows={3} sx={dialogFieldSx} />
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
            <TextField select label="Tipo" value={adjustData.tipo} onChange={e => setAdjustData(p => ({...p,tipo:e.target.value as any}))} SelectProps={{ native:true }} sx={dialogFieldSx}><option value="entrada">Entrada</option><option value="saida">Saida</option></TextField>
            <TextField fullWidth label="Justificativa *" placeholder="Motivo do ajuste" value={adjustData.justificativa} onChange={e => setAdjustData(p => ({...p,justificativa:e.target.value}))} multiline rows={3} sx={dialogFieldSx} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustDialogOpen(false)} disabled={submitting} sx={{ color:'rgba(255,255,255,0.6)' }}>Cancelar</Button>
          <Button onClick={handleAdjustConfirm} variant="contained" disabled={submitting||!adjustData.justificativa.trim()||!adjustData.date||!adjustData.time} sx={{ background:'#2563eb','&:hover':{ background:'#1d4ed8' } }}>{submitting?'Ajustando...':'Confirmar'}</Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG EMAIL */}
      <Dialog open={emailDialogOpen} onClose={() => !emailEnviando&&setEmailDialogOpen(false)} PaperProps={{ sx:{ borderRadius:2, background:'rgba(15,23,42,0.97)', border:'1px solid rgba(255,255,255,0.1)', color:'white' } }}>
        <DialogTitle sx={{ fontWeight:700, color:'white' }}>
          Enviar Relatorio por Email
          <IconButton onClick={() => !emailEnviando&&setEmailDialogOpen(false)} sx={{ position:'absolute', right:12, top:12, color:'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Email destinatario" type="email" fullWidth value={emailDestino} onChange={e => setEmailDestino(e.target.value)} disabled={emailEnviando} sx={{ mt:1,...dialogFieldSx }} />
          <Box sx={{ mt:2, p:1.5, background:'rgba(255,255,255,0.04)', borderRadius:1 }}>
            <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.5)' }}>Funcionario: <strong style={{ color:'rgba(255,255,255,0.8)' }}>{selectedEmployee?.nome}</strong> - {diasTrabalhados.length} dias - {selectedMonth}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)} disabled={emailEnviando} sx={{ color:'rgba(255,255,255,0.6)' }}>Cancelar</Button>
          <Button onClick={enviarPorEmail} disabled={emailEnviando||!emailDestino} variant="contained" startIcon={emailEnviando?<CircularProgress size={18} color="inherit" />:<EmailIcon />}>{emailEnviando?'Enviando...':'Enviar'}</Button>
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
