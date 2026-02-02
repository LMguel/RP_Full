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
} from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import UnifiedRecordsFilter from './UnifiedRecordsFilter';
import { getDailySummaries, getDayDetails } from '../services/dailySummaryService';
import { apiService } from '../services/api';
import TimeRecordsModal from './TimeRecordsModal';
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

const DailyRecordsTable: React.FC<DailyRecordsTableProps> = ({ reloadToken = 0 }) => {
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

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
      console.log('[DailyRecordsTable] Response completa:', response);
      
      if (!response || !response.summaries) {
        console.log('[DailyRecordsTable] Response ou summaries é null/undefined');
        setSummaries([]);
        return;
      }

      console.log('[DailyRecordsTable] summaries recebidos:', response.summaries.length);
      console.log('[DailyRecordsTable] Primeiro item:', response.summaries[0]);

      const normalized = response.summaries.map((s: any) => ({
        employee_id: s.employee_id || s.funcionario_id || s.id,
        employee_name: s.employee_name || s.nome || s.name,
        date: s.date || s.data,
        first_entry_time: s.first_entry_time || s.hora_entrada || s.actual_start,
        last_exit_time: s.last_exit_time || s.hora_saida || s.actual_end,
        worked_hours: s.worked_hours || s.horas_trabalhadas || 0,
        worked_hours_str: s.horas_trabalhadas_str || null,
        saida_automatica: s.saida_automatica || false,
        intervalo_descontado: s.intervalo_descontado || 60,
        raw: s,
      }));

      console.log('[DailyRecordsTable] Normalized:', normalized.length, normalized[0]);
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

  const exportToExcel = () => {
    if (!summaries.length) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    const rows = summaries.map(s => ({
      Data: formatDateLabel(s.date),
      Funcionário: s.employee_name,
      Entrada: s.first_entry_time || '-',
      Saída: s.last_exit_time ? (s.saida_automatica ? `${s.last_exit_time} (auto)` : s.last_exit_time) : '-',
      'Horas Trabalhadas': s.worked_hours_str || '-',
    }));
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
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
    return `${d}/${m}/${y} (${weekday})`;
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
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Data</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Funcionário</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Entrada</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Saída</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Horas Trabalhadas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  <Typography variant="body2" sx={{ mt: 2, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Carregando registros...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    Nenhum registro encontrado
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              summaries
                .filter(s => !selectedEmployee || s.employee_id === selectedEmployee.id)
                .map(s => (
                  <TableRow key={`${s.employee_id}-${s.date}`} sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                        {formatDate(s.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        onClick={() => handleEmployeeClick(s)}
                        sx={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', '&:hover': { color: 'rgba(255, 255, 255, 1)' } }}
                      >
                        {s.employee_name}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>{s.first_entry_time || '—'}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ color: s.saida_automatica ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255, 255, 255, 0.8)' }}>
                          {s.last_exit_time || '—'}
                        </Typography>
                        {s.saida_automatica && (
                          <Typography variant="caption" sx={{ color: 'rgba(251, 191, 36, 0.7)', fontSize: '0.65rem' }}>
                            (auto)
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        {s.worked_hours_str ? (
                          <>
                            <ScheduleIcon sx={{ fontSize: 16, color: 'rgba(74, 222, 128, 0.8)' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(74, 222, 128, 0.9)', fontWeight: 500 }}>
                              {s.worked_hours_str}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>—</Typography>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TimeRecordsModal open={modalOpen} onClose={() => setModalOpen(false)} summary={selectedSummary} records={modalRecords} loading={modalLoading} />
    </Paper>
  );
};

export default DailyRecordsTable;
