import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
} from '@mui/material';
import { AccessTime as AccessTimeIcon } from '@mui/icons-material';
import UnifiedRecordsFilter from './UnifiedRecordsFilter';
import { getDailySummaries, getDayDetails } from '../services/dailySummaryService';
import { apiService } from '../services/api';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface Employee {
  id: string;
  nome: string;
  cargo?: string;
}

interface DailyRecordsTableProps {
  reloadToken?: number;
}

const formatDateForInput = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const formatDateLabel = (value?: string): string => {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
};

// Funções utilitárias para mês
const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${month.toString().padStart(2, '0')}`;
};

const getFirstDayOfMonth = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number);
  return `${year}-${month.toString().padStart(2, '0')}-01`;
};

const getLastDayOfMonth = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
};

const getMonthFromDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${month.toString().padStart(2, '0')}`;
};

// Helpers de jornada
const toHHMM = (totalMin: number): string => {
  const abs = Math.abs(totalMin);
  return `${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const minutosPrevistosDia = (horario_entrada: string, horario_saida: string, intervalo_min: number): number => {
  const parseHHMM = (s: string) => { const [h, m] = (s || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  return Math.max(0, parseHHMM(horario_saida) - parseHHMM(horario_entrada) - intervalo_min);
};

const DailyRecordsTable: React.FC<DailyRecordsTableProps> = ({ reloadToken = 0 }) => {
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const todayISO = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;

  // Tipo simplificado para filtro
  type EmployeeOption = { id: string; nome: string; cargo?: string };

  const [dateRange, setDateRange] = useState({
    start_date: formatDateForInput(currentMonthStart),
    end_date: formatDateForInput(currentMonthEnd),
  });
  
  // Estados para filtros unificados
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const [summaries, setSummaries] = useState<any[]>([]);
  // Mapa employee_id → jornada { horario_entrada, horario_saida, intervalo_min }
  const [scheduleMap, setScheduleMap] = useState<Record<string, { horario_entrada: string; horario_saida: string; intervalo_min: number; custom_schedule?: any }>>({});
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalRecords, setModalRecords] = useState<any[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<any | null>(null);

  // Carregar lista de funcionários
  const loadEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      const response = await apiService.getEmployees();
      const employeesList = response.funcionarios || [];
      const sortedEmployees = [...employeesList].sort((a: Employee, b: Employee) =>
        (a.nome || '').localeCompare(b.nome || '')
      );
      setEmployees(sortedEmployees);
      // Montar mapa de jornada por funcionário
      const map: Record<string, { horario_entrada: string; horario_saida: string; intervalo_min: number; custom_schedule?: any }> = {};
      employeesList.forEach((emp: any) => {
        const id = emp.id || emp.funcionario_id;
        if (id) {
          map[String(id)] = {
            horario_entrada: emp.horario_entrada || '08:00',
            horario_saida: emp.horario_saida || '17:00',
            intervalo_min: Number(emp.intervalo_emp ?? emp.duracao_intervalo ?? 60),
            custom_schedule: emp.custom_schedule,
          };
        }
      });
      setScheduleMap(map);
    } catch (err) {
      console.error('Error loading employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (dateRange.start_date) filters.start_date = dateRange.start_date;
      if (dateRange.end_date) filters.end_date = dateRange.end_date;
      const response = await getDailySummaries(filters, 1, 500);

      if (!response || !response.summaries) {
        setSummaries([]);
        return;
      }

      const normalized = response.summaries.map((s: any) => {
        const extrasMin = Number(s.horas_extras_min ?? s.horas_extras ?? 0);
        const bancoMin  = s.banco_horas_dia != null ? Number(s.banco_horas_dia) : null;
        return {
          employee_id: s.employee_id || s.funcionario_id || s.id,
          employee_name: s.employee_name || s.nome || s.name,
          date: s.date || s.data,
          first_entry_time: s.first_entry_time || s.hora_entrada || s.actual_start,
          intervalo_saida: s.intervalo_saida || null,
          intervalo_volta: s.intervalo_volta || null,
          intervalo_automatico: s.intervalo_automatico ?? false,
          last_exit_time: s.last_exit_time || s.hora_saida || s.actual_end,
          worked_hours: s.worked_hours || s.horas_trabalhadas || 0,
          worked_hours_str: s.horas_trabalhadas_str || null,
          horas_extras_min: extrasMin,
          horas_extras_str: extrasMin > 0 ? (s.horas_extras_str || null) : null,
          atraso_minutos: Number(s.atraso_minutos ?? 0),
          banco_horas_dia: bancoMin,
          banco_horas_dia_str: s.banco_horas_dia_str ?? null,
          intervalo_descontado: s.intervalo_descontado ?? 0,
          horas_previstas_str: s.horas_previstas_str ?? null,
          horas_previstas_min: s.horas_previstas_min ?? null,
          horario_variavel: s.horario_variavel ?? false,
          raw: s,
        };
      });

      setSummaries(normalized);
    } catch (err: any) {
      console.error('Erro ao carregar summaries', err);
      toast.error('Erro ao carregar registros');
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange.start_date, dateRange.end_date]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries, reloadToken]);

  const handleDateRangeChange = (newRange: typeof dateRange) => {
    setDateRange(newRange);
    // Atualizar mês se as datas estão no mesmo mês
    if (newRange.start_date && newRange.end_date) {
      const monthFrom = getMonthFromDate(newRange.start_date);
      const monthTo = getMonthFromDate(newRange.end_date);
      if (monthFrom === monthTo) {
        setSelectedMonth(monthFrom);
      } else {
        setSelectedMonth('');
      }
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month) {
      setDateRange({
        start_date: getFirstDayOfMonth(month),
        end_date: getLastDayOfMonth(month)
      });
    }
  };

  const handleEmployeeClick = async (summary: any) => {
    setSelectedSummary(summary);
    setModalOpen(true);
    setModalLoading(true);
    try {
      const res = await getDayDetails(summary.employee_id, summary.date);
      setModalRecords(res.records || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar detalhes do dia');
      setModalRecords([]);
    } finally {
      setModalLoading(false);
    }
  };

  const clearFilters = () => {
    setDateRange({ start_date: formatDateForInput(currentMonthStart), end_date: formatDateForInput(currentMonthEnd) });
    setSelectedEmployee(null);
    setSelectedMonth(getCurrentMonth());
  };

  const getExpectedMinutesForDate = (dateStr: string, sched?: { horario_entrada: string; horario_saida: string; intervalo_min: number; custom_schedule?: any }) => {
    if (!sched || !dateStr) return null;
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(dateStr + 'T12:00:00').getDay()];
    const daySchedule = sched.custom_schedule?.[dayKey];
    const active = daySchedule?.active;
    if (active === false) {
      return 0;
    }
    const entrada = daySchedule?.start || sched.horario_entrada;
    const saida = daySchedule?.end || sched.horario_saida;
    if (!entrada || !saida) return 0;
    return minutosPrevistosDia(entrada, saida, sched.intervalo_min);
  };

  const exportToExcel = () => {
    if (!summaries.length) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    const rows = summaries.map(s => {
      const isToday = (s.date || '') === todayISO;
      // Previsto vem do backend (fonte única). Variável não tem previsto.
      const previsto = isToday ? '—' : (s.horario_variavel ? '—' : (s.horas_previstas_str || '-'));
      const rawStatus = isToday ? 'Em processamento' : String(s.raw?.status || '—');
      return {
        Data: formatDateLabel(s.date),
        Funcionário: s.employee_name,
        Status: rawStatus,
        Entrada: s.first_entry_time || '-',
        'Saída Intervalo': s.intervalo_saida || (s.intervalo_automatico ? '*' : '-'),
        'Volta Intervalo': s.intervalo_volta || (s.intervalo_automatico ? '*' : '-'),
        Saída: s.last_exit_time || '-',
        'Horas Trabalhadas': isToday ? '—' : (s.worked_hours_str || '-'),
        'Horas Previstas': previsto,
        'Hora Extra': isToday ? '—' : (s.horas_extras_str ? `+${s.horas_extras_str}` : '-'),
        'Atrasos': isToday ? '—' : (s.atraso_minutos > 0 ? `-${toHHMM(s.atraso_minutos)}` : '-'),
        'Banco Dia': isToday ? '—' : (s.banco_horas_dia == null ? '-' : `${s.banco_horas_dia >= 0 ? '+' : '-'}${s.banco_horas_dia_str || toHHMM(s.banco_horas_dia)}`),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros Diarios');
    XLSX.writeFile(wb, `registros-diarios-${formatDateLabel(dateRange.start_date)}-a-${formatDateLabel(dateRange.end_date)}.xlsx`);
    toast.success('Exportado');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [y, m, d] = dateString.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return { full: `${d}/${m}/${y}`, weekday };
  };

  return (
    <Paper sx={{ borderRadius: 2, background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
      {/* Filtros Unificados */}
      <UnifiedRecordsFilter
        selectedEmployee={selectedEmployee}
        onEmployeeChange={setSelectedEmployee}
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        onClearFilters={clearFilters}
        onExportExcel={exportToExcel}
        showExportButton={true}
        exportDisabled={summaries.length === 0}
        employees={employees}
      />

      {/* Divisória */}
      <Box sx={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)' }} />

      {/* Tabela */}
      <TableContainer sx={{ background: 'transparent' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Data', 'Funcionário', 'Status', 'Entrada', 'Saída Int.', 'Volta Int.', 'Saída', 'H. Trabalhadas', 'H. Previstas', 'H. Extra', 'Atrasos', 'Banco Dia'].map((h, i) => (
                <TableCell key={h} align={i < 2 ? 'left' : 'center'}
                  sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid rgba(255,255,255,0.1)', py: 1.5, px: i < 2 ? 2 : 1, whiteSpace: 'nowrap',
                    color: h === 'H. Extra' ? '#a78bfa' : h === 'Atrasos' ? '#f59e0b' : h === 'Banco Dia' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.7)',
                  }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  <Typography variant="body2" sx={{ mt: 2, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Carregando registros...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    Nenhum registro encontrado
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              summaries
                .filter(s => !selectedEmployee || s.employee_id === selectedEmployee.id)
                .map(s => {
                  const isToday = (s.date || '') === todayISO;
                  // Previsto vem do BACKEND (fonte única — mesma lógica do espelho)
                  const previstoStr = s.horario_variavel ? null : (s.horas_previstas_str || null);
                  const dateFmt = formatDate(s.date);
                  const cellSx = { py: 1, px: 1 };
                  const monoSx = { fontFamily: 'monospace', fontSize: 12 };

                  // Status chip
                  const rawStatus = isToday ? 'EM_PROCESSAMENTO' : String(s.raw?.status || '').toUpperCase();
                  const statusCfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
                    PRESENTE:         { label: '✓ Presente',       color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)' },
                    ATRASO:           { label: '! Atraso',          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
                    INCOMPLETO:       { label: '⚠ Incompleto',      color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)' },
                    FALTA:            { label: '✗ Falta',           color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
                    FERIADO:          { label: 'F Feriado',         color: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.35)' },
                    FERIAS:           { label: '🏖 Férias/Folga',   color: '#a78bfa', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.35)' },
                    ATESTADO:         { label: '🩺 Atestado',       color: '#2dd4bf', bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.35)' },
                    EM_PROCESSAMENTO: { label: '⏳ Processando',    color: 'rgba(148,163,184,0.85)', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.32)' },
                  };
                  const sc = statusCfg[rawStatus] || { label: '—', color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' };

                  return (
                  <TableRow key={`${s.employee_id}-${s.date}`} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.06)' }, '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' }, ...(isToday && { background: 'rgba(100,116,139,0.04)' }) }}>
                    {/* Data */}
                    <TableCell sx={{ py: 1, px: 2 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: isToday ? 'rgba(148,163,184,0.8)' : 'white', fontSize: 12, whiteSpace: 'nowrap' }}>{dateFmt.full}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize', fontSize: 10 }}>{dateFmt.weekday}</Typography>
                    </TableCell>
                    {/* Funcionário */}
                    <TableCell sx={{ py: 1, px: 2 }}>
                      <Typography variant="body2" onClick={() => handleEmployeeClick(s)}
                        sx={{ cursor: 'pointer', fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontSize: 12,
                          '&:hover': { color: 'white', textDecoration: 'underline' } }}>
                        {s.employee_name}
                      </Typography>
                    </TableCell>
                    {/* Status */}
                    <TableCell align="center" sx={{ py: 1, px: 1 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
                        <Chip label={sc.label} size="small"
                          onClick={rawStatus === 'ATESTADO' && s.raw?.atestado_url ? () => window.open(s.raw.atestado_url, '_blank') : undefined}
                          sx={{ height: 18, fontSize: 10, fontWeight: 700, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, cursor: rawStatus === 'ATESTADO' && s.raw?.atestado_url ? 'pointer' : 'default' }} />
                        {rawStatus === 'ATESTADO' && s.raw?.atestado_url && (
                          <Typography sx={{ fontSize: 9, color: 'rgba(45,212,191,0.7)', textDecoration: 'underline', cursor: 'pointer' }}
                            onClick={() => window.open(s.raw.atestado_url, '_blank')}>Ver doc</Typography>
                        )}
                      </Box>
                    </TableCell>
                    {/* Entrada */}
                    <TableCell align="center" sx={cellSx}>
                      <Typography variant="body2" sx={{ ...monoSx, color: 'rgba(255,255,255,0.85)' }}>{s.first_entry_time || '—'}</Typography>
                    </TableCell>
                    {/* Saída Intervalo */}
                    <TableCell align="center" sx={cellSx}>
                      <Typography variant="body2" sx={{ ...monoSx,
                        color: s.intervalo_automatico && !s.intervalo_saida ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)',
                        fontStyle: s.intervalo_automatico && !s.intervalo_saida ? 'italic' : 'normal' }}>
                        {s.intervalo_saida || (s.intervalo_automatico ? '*' : '—')}
                      </Typography>
                    </TableCell>
                    {/* Volta Intervalo */}
                    <TableCell align="center" sx={cellSx}>
                      <Typography variant="body2" sx={{ ...monoSx,
                        color: s.intervalo_automatico && !s.intervalo_volta ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)',
                        fontStyle: s.intervalo_automatico && !s.intervalo_volta ? 'italic' : 'normal' }}>
                        {s.intervalo_volta || (s.intervalo_automatico ? '*' : '—')}
                      </Typography>
                    </TableCell>
                    {/* Saída */}
                    <TableCell align="center" sx={cellSx}>
                      <Typography variant="body2" sx={{ ...monoSx, color: 'rgba(255,255,255,0.85)' }}>{s.last_exit_time || '—'}</Typography>
                    </TableCell>
                    {/* Horas Trabalhadas */}
                    <TableCell align="center" sx={cellSx}>
                      <Typography variant="body2" sx={{ ...monoSx, color: isToday ? 'rgba(255,255,255,0.3)' : 'white', fontWeight: isToday ? 400 : 700 }}>
                        {isToday ? '—' : (s.worked_hours_str || '—')}
                      </Typography>
                    </TableCell>
                    {/* Horas Previstas */}
                    <TableCell align="center" sx={cellSx}>
                      <Typography variant="body2" sx={{ ...monoSx, color: 'rgba(255,255,255,0.5)' }}>
                        {isToday ? '—' : (previstoStr || '—')}
                      </Typography>
                    </TableCell>
                    {/* Hora Extra */}
                    <TableCell align="center" sx={cellSx}>
                      {isToday ? (
                        <Typography variant="body2" sx={{ ...monoSx, color: 'rgba(255,255,255,0.25)' }}>—</Typography>
                      ) : (
                        <Typography variant="body2" sx={{ ...monoSx, color: s.horas_extras_str ? '#4ade80' : 'rgba(255,255,255,0.3)', fontWeight: s.horas_extras_str ? 700 : 400 }}>
                          {s.horas_extras_str ? `+${s.horas_extras_str}` : '—'}
                        </Typography>
                      )}
                    </TableCell>
                    {/* Atrasos */}
                    <TableCell align="center" sx={cellSx}>
                      {isToday ? (
                        <Typography variant="body2" sx={{ ...monoSx, color: 'rgba(255,255,255,0.25)' }}>—</Typography>
                      ) : (
                        <Typography variant="body2" sx={{ ...monoSx, color: s.atraso_minutos > 0 ? '#f59e0b' : 'rgba(255,255,255,0.3)', fontWeight: s.atraso_minutos > 0 ? 700 : 400 }}>
                          {s.atraso_minutos > 0 ? `-${toHHMM(s.atraso_minutos)}` : '—'}
                        </Typography>
                      )}
                    </TableCell>
                    {/* Banco Dia */}
                    <TableCell align="center" sx={cellSx}>
                      {isToday ? (
                        <Typography variant="body2" sx={{ ...monoSx, color: 'rgba(255,255,255,0.25)' }}>—</Typography>
                      ) : s.banco_horas_dia == null ? (
                        <Typography variant="body2" sx={{ ...monoSx, color: 'rgba(255,255,255,0.25)' }}>—</Typography>
                      ) : (
                        <Typography variant="body2" sx={{ ...monoSx,
                          color: s.banco_horas_dia > 0 ? '#4ade80' : s.banco_horas_dia < 0 ? '#f87171' : 'rgba(255,255,255,0.4)',
                          fontWeight: s.banco_horas_dia !== 0 ? 700 : 400 }}>
                          {`${s.banco_horas_dia >= 0 ? '+' : '-'}${s.banco_horas_dia_str || toHHMM(s.banco_horas_dia)}`}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default DailyRecordsTable;
