import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Button,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import UnifiedRecordsFilter from '../components/UnifiedRecordsFilter';
import TimeRecordForm from '../components/TimeRecordForm';
import { motion } from 'framer-motion';
import XLSXStyle from 'xlsx-js-style';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Employee } from '../types';

interface EmployeeSummary {
  employee_id: string;
  funcionario: string;
  funcionario_nome: string;
  horas_trabalhadas: number; // minutos
  horas_extras: number;      // minutos
  saldo: number;             // minutos (pode ser negativo)
  variavel: boolean;         // horário variável: sem previsto/banco
  atrasos: number;           // minutos
  total_registros?: number;
}



const RecordsSummaryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Tipo simplificado para filtro de funcionário
  type EmployeeOption = { id: string; nome: string; cargo?: string };
  
  // Estados principais
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtros unificados
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  
  // Estados para filtros
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const [dateRange, setDateRange] = useState({
    start_date: currentMonthStart.toISOString().split('T')[0],
    end_date: currentMonthEnd.toISOString().split('T')[0]
  });
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Estados para snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // Estados para o formulário de adicionar registro
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Função para formatar minutos em HH:MM
  const formatMinutesToHHMM = (minutes: number): string => {
    if (minutes === 0) return '00:00';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Formata saldo (pode ser negativo) em ±HH:MM
  const formatSaldo = (minutes: number): string => {
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Função atualizada para formatar horas trabalhadas - INCLUINDO MINUTOS
  const formatHoursWorked = (horasValue: number | string): string => {
    console.log('📊 [FORMAT] Valor recebido:', horasValue);
    
    // Se é um número decimal (ex: 8.5 horas = 8h 30min)
    if (typeof horasValue === 'number') {
      if (horasValue === 0) return '00:00';
      
      const hours = Math.floor(horasValue);
      const decimalPart = horasValue - hours;
      const minutes = Math.round(decimalPart * 60);
      
      const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      return result;
    }
    
    // Se já é uma string no formato correto HH:MM, retornar
    if (typeof horasValue === 'string' && horasValue.match(/^\d{1,3}:\d{2}$/)) {
      return horasValue;
    }
    
    // Se é uma string que contém "day", extrair e converter corretamente
    if (typeof horasValue === 'string' && horasValue.includes('day')) {
      let totalMinutes = 0;
      
      // Extrair dias se existir
      const dayMatch = horasValue.match(/(\d+)\s*day/);
      if (dayMatch) {
        const days = parseInt(dayMatch[1]);
        totalMinutes += days * 24 * 60; // Converter dias para minutos
      }
      
      // Extrair horas e minutos se existir (formato HH:MM:SS ou HH:MM)
      const timeMatch = horasValue.match(/(\d+):(\d+)(?::(\d+))?/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        totalMinutes += (hours * 60) + minutes;
      }
      
      // Converter total de minutos para formato HH:MM
      const finalHours = Math.floor(totalMinutes / 60);
      const finalMinutes = totalMinutes % 60;
      const result = `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
      
      return result;
    }
    
    // Se é uma string numérica, converter
    if (typeof horasValue === 'string') {
      const numValue = parseFloat(horasValue);
      if (!isNaN(numValue)) {
        const hours = Math.floor(numValue);
        const decimalPart = numValue - hours;
        const minutes = Math.round(decimalPart * 60);
        
        const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        return result;
      }
    }
    
    return '00:00';
  };

  // Funções utilitárias para filtro de mês
  const getFirstDayOfMonth = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-').map(Number);
    return `${year}-${month.toString().padStart(2, '0')}-01`;
  };

  const getLastDayOfMonth = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  };

  const getCurrentMonth = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() retorna 0-11
    return `${year}-${month.toString().padStart(2, '0')}`;
  };

  const getMonthFromDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}`;
  };

  // Função para buscar registros
  const buscarRegistros = useCallback(async () => {
    if (dateRange.start_date && dateRange.end_date && dateRange.start_date > dateRange.end_date) {
      setError('A data de início não pode ser maior que a data de fim.');
      setEmployeeSummaries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Usar /api/registros-diarios — mesmo motor canônico do espelho de ponto
      const params: Record<string, string> = { page_size: '2000' };
      if (dateRange.start_date) params.start_date = dateRange.start_date;
      if (dateRange.end_date) params.end_date = dateRange.end_date;
      if (selectedEmployee?.id) params.employee_id = selectedEmployee.id;

      const response = await apiService.get('/api/registros-diarios', params);
      const dailyList: any[] = response?.summaries || [];

      // Agregar por funcionário
      const byEmployee: Record<string, { nome: string; minTrabalhados: number; minPrevistos: number; saldoMin: number; variavel: boolean }> = {};
      for (const day of dailyList) {
        const empId = String(day.employee_id || '');
        if (!empId) continue;
        if (!byEmployee[empId]) {
          byEmployee[empId] = { nome: day.nome || empId, minTrabalhados: 0, minPrevistos: 0, saldoMin: 0, variavel: false };
        }
        byEmployee[empId].minTrabalhados += Number(day.horas_trabalhadas_min || 0);
        byEmployee[empId].minPrevistos   += Number(day.horas_previstas_min   || 0);
        byEmployee[empId].saldoMin       += Number(day.banco_horas_dia       || 0);
        if (day.horario_variavel) byEmployee[empId].variavel = true;
      }

      const summaries: EmployeeSummary[] = Object.entries(byEmployee).map(([empId, data]) => ({
        employee_id:       empId,
        funcionario:       data.nome,
        funcionario_nome:  data.nome,
        horas_trabalhadas: data.minTrabalhados,
        horas_extras:      Math.max(0, data.saldoMin),
        saldo:             data.saldoMin,
        variavel:          data.variavel,
        atrasos:           0,
        total_registros:   0,
      }));

      summaries.sort((a, b) => (a.funcionario_nome || '').localeCompare(b.funcionario_nome || ''));

      console.log('📊 [RESUMO] Summaries processados:', summaries);
      setEmployeeSummaries(summaries);

    } catch (err: any) {
      console.error('❌ Erro ao buscar resumo:', err);
      setError('Erro ao carregar resumo. Tente novamente.');
      showSnackbar('Erro ao carregar resumo', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange.start_date, dateRange.end_date, selectedEmployee?.id]);

  // Navegação via clique na tabela de resumo
  const handleClickFuncionario = (summary: EmployeeSummary) => {
    if (summary && summary.employee_id) {
      const funcionarioNome = summary.funcionario || summary.funcionario_nome || 'Funcionário';
      navigate(`/records/employee/${summary.employee_id}/${encodeURIComponent(funcionarioNome)}`);
    } else {
      showSnackbar('ID do funcionário não encontrado', 'error');
    }
  };

  // Manipulação do filtro de mês
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month) {
      // Quando um mês é selecionado, definir as datas automaticamente
      setDateRange({
        start_date: getFirstDayOfMonth(month),
        end_date: getLastDayOfMonth(month)
      });
    } else {
      // Se mês for limpo, remover filtro de datas para mostrar todos os registros
      setDateRange({ start_date: '', end_date: '' });
    }
  };

  const handleDateRangeChange = (newRange: typeof dateRange) => {
    // Normalizar valores nulos/undefined para string vazia
    const normalized = {
      start_date: newRange.start_date || '',
      end_date: newRange.end_date || ''
    };

    setDateRange(normalized);

    // Atualizar mês selecionado se as datas estão no mesmo mês, senão limpar
    if (normalized.start_date && normalized.end_date) {
      const monthFromDate = getMonthFromDate(normalized.start_date);
      const monthToDate = getMonthFromDate(normalized.end_date);
      if (monthFromDate === monthToDate) {
        setSelectedMonth(monthFromDate);
      } else {
        setSelectedMonth('');
      }
    } else {
      setSelectedMonth('');
    }
  };

  // Limpar filtros (incluindo mês)
  const handleClearFilters = () => {
    setDateRange({
      start_date: currentMonthStart.toISOString().split('T')[0],
      end_date: currentMonthEnd.toISOString().split('T')[0]
    });
    setSelectedMonth('');
    setSelectedEmployee(null);
  };

  // Efeitos
  useEffect(() => {
    buscarRegistros();
  }, [buscarRegistros]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await apiService.getEmployees();
        const employeesList = response.funcionarios || [];
        // Ordenar alfabeticamente
        const sortedEmployees = [...employeesList].sort((a: Employee, b: Employee) =>
          (a.nome || '').localeCompare(b.nome || '')
        );
        setEmployees(sortedEmployees);
      } catch (err) {
        console.error('Erro ao buscar funcionários:', err);
        showSnackbar('Erro ao carregar lista de funcionários', 'error');
      }
    };
    fetchEmployees();
  }, []);

  // Inicializar mês atual
  useEffect(() => {
    const currentMonth = getCurrentMonth();
    setSelectedMonth(currentMonth);
    // Definir datas do mês atual
    setDateRange({
      start_date: getFirstDayOfMonth(currentMonth),
      end_date: getLastDayOfMonth(currentMonth)
    });
  }, []);

  // Snackbar
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // Adicionar Registro
  const handleAddRecord = () => {
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
  };

  const handleSaveRecord = async (recordData: {
    employee_id: string;
    data_hora: string;
    tipo: 'entrada' | 'saída' | 'dia_inteiro';
    justificativa: string;
  }) => {
    setSubmitting(true);
    try {
      await apiService.registerTimeManual(recordData);
      showSnackbar('Registro adicionado com sucesso!', 'success');
      setFormOpen(false);
      buscarRegistros(); // Recarregar registros
    } catch (err) {
      console.error('Erro ao adicionar registro:', err);
      showSnackbar('Erro ao adicionar registro.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Exportar para Excel
  const exportToExcel = async () => {
    if (employeeSummaries.length === 0) return;
    showSnackbar('Gerando Excel, aguarde...', 'info');

    try {
      // ── Estilos preto e branco idênticos ao EmployeeRecordsPage ──
      const bThin  = { style: 'thin',   color: { rgb: '000000' } };
      const bThick = { style: 'medium', color: { rgb: '000000' } };
      const bAll   = { top: bThin, bottom: bThin, left: bThin, right: bThin };
      const bBox   = { top: bThick, bottom: bThick, left: bThick, right: bThick };
      const W      = { fgColor: { rgb: 'FFFFFF' } };
      const GRAY   = { fgColor: { rgb: 'D9D9D9' } };
      const sTitle = { font: { bold: true, sz: 13, color: { rgb: '000000' } }, fill: GRAY, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: bBox };
      const sMeta  = { font: { sz: 11, color: { rgb: '000000' } }, fill: W, alignment: { horizontal: 'left', vertical: 'center' }, border: bAll };
      const sHdr   = (left = false) => ({ font: { bold: true, sz: 11, color: { rgb: '000000' } }, fill: GRAY, alignment: { horizontal: left ? 'left' : 'center', vertical: 'center', wrapText: true }, border: bAll });
      const sCell  = (bold = false, left = false) => ({ font: { bold, sz: 11, color: { rgb: '000000' } }, fill: W, alignment: { horizontal: left ? 'left' : 'center', vertical: 'center', wrapText: true }, border: bAll });
      const sSaldo = (pos: boolean) => ({ font: { bold: true, sz: 11, color: { rgb: '000000' } }, fill: pos ? { fgColor: { rgb: 'D9EAD3' } } : { fgColor: { rgb: 'FCE5CD' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: bAll });
      const sEmpty = { font: { sz: 10 }, fill: W, border: bAll };

      const COLS8 = ['A','B','C','D','E','F','G','H'];
      const styleRow = (ws: any, r: number, fn: (ci: number) => any) =>
        COLS8.forEach((c, ci) => { const ref = c + r; if (ws[ref]) ws[ref].s = fn(ci); });

      // ── Helpers ──────────────────────────────────────────────
      const parseDataHora = (s: string): Date => {
        if (!s) return new Date(0);
        const [datePart, timePart = ''] = s.includes('T') ? s.split('T') : s.split(' ');
        const segs = datePart.split('-');
        const iso = segs[0].length === 4 ? `${datePart}T${timePart}` : `${segs[2]}-${segs[1]}-${segs[0]}T${timePart}`;
        return new Date(iso);
      };
      const toHHMM = (min: number) => { const s = min < 0 ? '-' : ''; const a = Math.abs(min); return `${s}${String(Math.floor(a/60)).padStart(2,'0')}:${String(a%60).padStart(2,'0')}`; };
      const fmtTime = (s: string) => { if (!s) return '-'; const t = s.includes('T') ? s.split('T')[1] : s.split(' ')[1]; return t ? t.substring(0,5) : '-'; };

      const calcMinutos = (records: any[]): number => {
        let total = 0; let entrada: Date | null = null;
        [...records].sort((a,b) => parseDataHora(a.data_hora||'').getTime()-parseDataHora(b.data_hora||'').getTime()).forEach(r => {
          const tipo = (r.type||r.tipo||'').toLowerCase();
          const dt = parseDataHora(r.data_hora||'');
          const knownEntry = ['entrada','retorno_almoco'].includes(tipo);
          const knownExit = ['saida','saída','saida_final','saída_final','checkout','saida_almoco','saida_antecipada'].includes(tipo);
          const isEntradaPos = !knownEntry && !knownExit && !entrada;
          const isSaidaPos = !knownEntry && !knownExit && !!entrada;
          if (knownEntry || isEntradaPos) { if (!entrada) entrada = dt; }
          else if ((knownExit || isSaidaPos) && entrada) {
            total += (dt.getTime() - (entrada as Date).getTime()) / 60000;
            entrada = null;
          }
        });
        return Math.round(total);
      };

      const buildDays = (records: any[], inicio: string, fim: string) => {
        const DEFAULT_INT = 60;
        const todayISO = new Date().toISOString().slice(0, 10);
        const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        const grouped: Record<string, any[]> = {};
        records.forEach((r: any) => {
          if (!r.data_hora) return;
          const raw = r.data_hora.includes('T') ? r.data_hora.split('T')[0] : r.data_hora.split(' ')[0];
          const segs = raw.split('-');
          const key = segs[0].length === 4 ? raw : `${segs[2]}-${segs[1]}-${segs[0]}`;
          grouped[key] = grouped[key] || [];
          grouped[key].push(r);
        });
        const result: any[] = [];
        const start = new Date(inicio + 'T12:00:00');
        const end   = new Date(fim   + 'T12:00:00');
        for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = d.toISOString().slice(0, 10);
          const dayRecs = grouped[iso] || [];
          const dow = d.getDay();
          const entRec    = dayRecs.find((r: any) => (r.type||r.tipo||'').toLowerCase() === 'entrada');
          const saiRec    = [...dayRecs].reverse().find((r: any) => ['saida','saída','saida_final','saída_final','checkout'].includes((r.type||r.tipo||'').toLowerCase()));
          const saiIntRec = dayRecs.find((r: any) => ['intervalo_inicio','saida_intervalo','intervalo_saida'].includes((r.type||r.tipo||'').toLowerCase()));
          const voltaRec  = dayRecs.find((r: any) => ['intervalo_fim','volta_intervalo','retorno','intervalo_volta'].includes((r.type||r.tipo||'').toLowerCase()));
          let horasTrab = '-', horasPrev = '-';
          if (dayRecs.length) {
            const rawMin = calcMinutos(dayRecs);
            const hasInt = !!(saiIntRec || voltaRec);
            horasTrab = toHHMM(hasInt ? rawMin : Math.max(0, rawMin - DEFAULT_INT));
          }
          if (dow >= 1 && dow <= 5) {
            if (entRec && saiRec) {
              const diffMin = (parseDataHora(saiRec.data_hora||'').getTime() - parseDataHora(entRec.data_hora||'').getTime()) / 60000;
              horasPrev = toHHMM(Math.max(0, diffMin - DEFAULT_INT));
            } else {
              horasPrev = '08:00';
            }
          }
          result.push({ iso, dia: DAYS[dow], dow, entrada: entRec ? fmtTime(entRec.data_hora||'') : '-', saida_int: saiIntRec ? fmtTime(saiIntRec.data_hora||'') : '-', volta_int: voltaRec ? fmtTime(voltaRec.data_hora||'') : '-', saida: saiRec ? fmtTime(saiRec.data_hora||'') : '-', horasTrab, horasPrev, hasRecs: dayRecs.length > 0, isPast: iso <= todayISO });
        }
        return result;
      };

      // ── Workbook ──────────────────────────────────────────────
      const wb = XLSXStyle.utils.book_new();
      const periodo = `${dateRange.start_date || '—'} a ${dateRange.end_date || '—'}`;

      // Aba 1: Resumo Geral
      const COLS4 = ['A','B','C','D'];
      const resumoAoa: any[][] = [
        ['RESUMO GERAL DE PONTO', '', '', ''],
        ['Período: ' + periodo, '', '', ''],
        ['Funcionário', 'H. Trabalhadas', 'Saldo', ''],
        ...employeeSummaries.map(s => [
          s.funcionario_nome || s.funcionario,
          formatMinutesToHHMM(s.horas_trabalhadas || 0),
          s.variavel ? '—' : formatSaldo(s.saldo ?? 0),
          '',
        ]),
      ];
      const wsG = XLSXStyle.utils.aoa_to_sheet(resumoAoa);
      const styleRow4 = (ws: any, r: number, fn: (ci: number) => any) =>
        COLS4.forEach((c, ci) => { const ref = c + r; if (ws[ref]) ws[ref].s = fn(ci); });
      styleRow4(wsG, 1, () => sTitle);
      styleRow4(wsG, 2, () => sMeta);
      styleRow4(wsG, 3, (ci) => ci < 3 ? sHdr(ci === 0) : sEmpty);
      employeeSummaries.forEach((_, ri) => styleRow4(wsG, 4 + ri, (ci) => ci < 3 ? sCell(false, ci === 0) : sEmpty));
      wsG['!cols'] = [{ wch: 32 }, { wch: 17 }, { wch: 14 }, { wch: 4 }];
      wsG['!merges'] = [{ s:{ r:0,c:0 }, e:{ r:0,c:3 } }, { s:{ r:1,c:0 }, e:{ r:1,c:3 } }];
      XLSXStyle.utils.book_append_sheet(wb, wsG, 'Resumo Geral');

      // Uma aba por funcionário
      for (const summary of employeeSummaries) {
        let records: any[] = [];
        try {
          const resp = await apiService.getTimeRecords({ funcionario_id: summary.employee_id, inicio: dateRange.start_date, fim: dateRange.end_date } as any);
          records = Array.isArray(resp) ? resp : [];
        } catch { records = []; }

        const days = buildDays(records, dateRange.start_date, dateRange.end_date);
        const daysWithRecs = days.filter(d => d.hasRecs);
        const todayISO = new Date().toISOString().slice(0, 10);
        const totalMin = daysWithRecs.reduce((acc, d) => { if (d.horasTrab === '-') return acc; const [h,m] = d.horasTrab.split(':').map(Number); return acc + h*60+(m||0); }, 0);
        const weekdaysPast = days.filter(d => d.dow >= 1 && d.dow <= 5 && d.isPast).length;
        const totalPrevMin = weekdaysPast * 8 * 60;
        const saldoMin = totalMin - totalPrevMin;
        const pct = Math.round((totalMin / (totalPrevMin || 1)) * 100);
        const presentes = daysWithRecs.length;
        const faltas = days.filter(d => d.dow >= 1 && d.dow <= 5 && !d.hasRecs && d.isPast).length;
        const nome = summary.funcionario_nome || summary.funcionario;

        const aoa: any[][] = [
          ['ESPELHO DE PONTO — ' + nome.toUpperCase(), '','','','','','',''],
          ['Período: ' + periodo, '','','','','','',''],
          ['Dias Trabalhados','Faltas','H. Trabalhadas','H. Previstas','Saldo de Horas','% de Cumprimento','',''],
          [presentes, faltas, toHHMM(totalMin), toHHMM(totalPrevMin), (saldoMin>=0?'+':'')+toHHMM(saldoMin), pct+'%','',''],
          ['','','','','','','',''],
          ['Data','Dia','Entrada','Saída Int.','Volta Int.','Saída','H. Trabalhadas','H. Previstas'],
          ...daysWithRecs.map(d => [d.iso.split('-').reverse().join('-'), d.dia, d.entrada, d.saida_int, d.volta_int, d.saida, d.horasTrab, d.horasPrev]),
        ];

        const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
        styleRow(ws, 1, () => sTitle);
        styleRow(ws, 2, () => sMeta);
        styleRow(ws, 3, (ci) => ci < 6 ? sHdr() : sEmpty);
        styleRow(ws, 4, (ci) => { if (ci===4) return sSaldo(saldoMin>=0); if (ci===5) return sCell(true); if (ci>=6) return sEmpty; return sCell(); });
        styleRow(ws, 5, () => sEmpty);
        styleRow(ws, 6, (ci) => sHdr(ci===0||ci===1));
        daysWithRecs.forEach((_, ri) => styleRow(ws, 7+ri, (ci) => { if (ci===0||ci===1) return sCell(false,true); if (ci===6) return sCell(true); return sCell(); }));
        ws['!cols'] = [{wch:14},{wch:6},{wch:10},{wch:13},{wch:13},{wch:12},{wch:16},{wch:16}];
        ws['!merges'] = [{ s:{r:0,c:0},e:{r:0,c:7} },{ s:{r:1,c:0},e:{r:1,c:7} },{ s:{r:4,c:0},e:{r:4,c:7} }];
        (ws as any)['!pageSetup'] = { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 };
        (ws as any)['!margins'] = { left:0.5, right:0.5, top:0.75, bottom:0.75, header:0.3, footer:0.3 };

        const sheetName = nome.replace(/[:\\/\[\]*?]/g, '').slice(0, 31);
        XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
      }

      const period = dateRange.start_date ? dateRange.start_date.slice(0, 7) : 'periodo';
      XLSXStyle.writeFile(wb, `Espelho-Geral-${period}.xlsx`);
      showSnackbar('Excel exportado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao exportar:', err);
      showSnackbar('Erro ao gerar Excel', 'error');
    }
  };

  // Renderização
  return (
    <PageLayout>
      <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold text-white">Espelho De Ponto</h1>
            <button
              onClick={handleAddRecord}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-lg"
            >
              + Adicionar Registro Manual
            </button>
          </div>
        </motion.div>

        <Paper sx={{
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden'
        }}>
          {/* Seção de Filtros Unificados */}
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

          {/* Linha divisória */}
          <Box sx={{ 
            height: '1px', 
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
            my: 0
          }} />

          {/* Seção da Tabela */}
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '18px'
                }}
              >
                Resumo por Funcionário ({employeeSummaries.length})
              </Typography>
            </Box>
            <Alert
              severity="info"
              variant="outlined"
              sx={{
                mb: 3,
                background: 'linear-gradient(90deg, rgba(2,136,209,0.06), rgba(14,165,233,0.02))',
                borderColor: 'rgba(14,165,233,0.3)',
                color: 'rgba(255,255,255,0.95)',
                fontWeight: 700,
                py: 1.5,
                px: 2,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              Clique no nome do funcionário para ver seu <strong>espelho de ponto individual</strong>
            </Alert>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>
            ) : (
              <TableContainer sx={{ background: 'transparent' }}>
                <Table aria-label="tabela de resumo de registros">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Funcionário</TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Horas Trabalhadas</TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Saldo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employeeSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={3} 
                          align="center"
                          sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
                        >
                          <Box sx={{ py: 8 }}>
                            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1 }}>
                              Nenhum resumo de registro encontrado
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                              Ajuste os filtros para visualizar os registros
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      employeeSummaries.map((summary, idx) => (
                        <TableRow key={summary.employee_id} hover>
                          <TableCell component="th" scope="row" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography 
                              variant="body2" 
                              onClick={() => handleClickFuncionario(summary)}
                              sx={{ 
                                fontWeight: 500, 
                                color: 'rgba(255, 255, 255, 0.9)',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                '&:hover': {
                                  color: 'rgba(255, 255, 255, 1)',
                                  textDecoration: 'underline',
                                }
                              }}
                            >
                              {summary.funcionario_nome || summary.funcionario}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {formatMinutesToHHMM(summary.horas_trabalhadas || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            {summary.variavel ? (
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                                —
                              </Typography>
                            ) : (
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 700,
                                  color: summary.saldo > 0 ? '#10b981' : summary.saldo < 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.5)',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {formatSaldo(summary.saldo)}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>

        <TimeRecordForm
          open={formOpen}
          onClose={handleCloseForm}
          onSubmit={handleSaveRecord}
          loading={submitting}
          employees={employees}
        />

        <Snackbar 
          open={snackbarOpen} 
          autoHideDuration={6000} 
          onClose={handleCloseSnackbar}
          anchorOrigin={{ 
            vertical: 'bottom', 
            horizontal: 'right' 
          }}
          sx={{
            marginLeft: '240px', // Espaço para o sidebar
            marginBottom: '20px',
            zIndex: 9999
          }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </div>
    </PageLayout>
  );
};

export default RecordsSummaryPage;