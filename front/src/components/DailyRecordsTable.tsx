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
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  TextField,
  MenuItem,
  Button,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon, CalendarMonth as CalendarIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { AlertTriangle, MapPin, Filter, RefreshCw } from 'lucide-react';
import type { DailySummary, DailySummaryFilters } from '../types/dailySummary';
import { getDailySummaries, getDayDetails } from '../services/dailySummaryService';
import TimeRecordsModal from './TimeRecordsModal';
import { DateRangePicker } from '../components/DateRangePicker';
import { toast } from 'react-hot-toast';

interface DailyRecordsTableProps {
  reloadToken?: number;
}

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value?: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  const isoCandidate = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoCandidate)) {
    const [year, month, day] = isoCandidate.split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toLocaleDateString('pt-BR');
};

const formatDateForFilename = (value?: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  const isoCandidate = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoCandidate)) {
    const [year, month, day] = isoCandidate.split('-');
    return `${day}-${month}-${year}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed.replace(/[\\/:*?"<>|\s]+/g, '-');
  }
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
};

import * as XLSX from 'xlsx';

const DailyRecordsTable: React.FC<DailyRecordsTableProps> = ({ reloadToken = 0 }) => {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<DailySummary | null>(null);
  const [modalRecords, setModalRecords] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Filtros
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const [dateRange, setDateRange] = useState({
    start_date: formatDateForInput(currentMonthStart),
    end_date: formatDateForInput(currentMonthEnd)
  });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [filteredEmployees, setFilteredEmployees] = useState<Array<{ id: string; nome: string }>>([]);
  const [statusFilter, setStatusFilter] = useState<DailySummary['status'] | ''>('');

  // Lista única de funcionários para o filtro
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; nome: string }>>([]);

  // Carregar dados
  const loadSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const filters: DailySummaryFilters = {};

      if (dateRange.start_date) {
        filters.start_date = dateRange.start_date;
      }
      if (dateRange.end_date) {
        filters.end_date = dateRange.end_date;
      }
      if (selectedMonth) {
        filters.month = selectedMonth;
      }
      
      if (selectedEmployeeId) filters.employee_id = selectedEmployeeId;
      if (statusFilter) filters.status = statusFilter;
      
      console.log('[DEBUG] Chamando getDailySummaries com filtros:', filters);
      const response = await getDailySummaries(filters, 1, 100);
      console.log('[DEBUG] Resposta recebida:', response);
      
      if (!response || !response.summaries) {
        console.error('[ERROR] Resposta inválida:', response);
        toast.error('Resposta da API inválida');
        setSummaries([]);
        setEmployees([]);
        return;
      }
      
      if (response.summaries.length > 0) {
        const first = response.summaries[0];
        console.log('[DEBUG] Primeiro sumário:', {
          employee_name: first.employee_name,
          first_entry_time: first.first_entry_time,
          last_exit_time: first.last_exit_time,
          worked_hours: first.worked_hours,
        });
      }
      
      setSummaries(response.summaries);

      const uniqueEmployees = Array.from(
        new Map(
          response.summaries.map((s) => [s.employee_id, { id: s.employee_id, name: s.employee_name }])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      
      setEmployees(uniqueEmployees);
    } catch (error: any) {
      console.error('Erro ao carregar registros diários:', error);
      console.error('Detalhes do erro:', error.response?.data);
      toast.error(error.response?.data?.error || 'Erro ao carregar dados');
      setSummaries([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange.start_date, dateRange.end_date, selectedEmployeeId, statusFilter, selectedMonth]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries, reloadToken]);

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
    const month = now.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}`;
  };

  const getMonthFromDate = (dateString: string): string => {
    if (!dateString) return '';
    const [year, month] = dateString.split('-');
    if (!year || !month) return '';
    return `${year}-${month.padStart(2, '0')}`;
  };

  // Carregar lista completa de funcionários
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/funcionarios', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await response.json();
        setAllEmployees(data.funcionarios || []);
      } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
      }
    };
    fetchEmployees();
  }, []);

  // Inicializar mês atual
  useEffect(() => {
    const currentMonth = getCurrentMonth();
    setSelectedMonth(currentMonth);
  }, []);

  const handleEmployeeClick = async (summary: DailySummary) => {
    setSelectedSummary(summary);
    setModalOpen(true);
    setModalLoading(true);

    try {
      const response = await getDayDetails(summary.employee_id, summary.date);
      setModalRecords(response.records);
    } catch (error: any) {
      console.error('Erro ao carregar detalhes:', error);
      toast.error('Erro ao carregar detalhes do dia');
      setModalRecords([]);
    } finally {
      setModalLoading(false);
    }
  };

  // Busca de funcionários conforme digita
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    
    if (!value.trim()) {
      setFilteredEmployees([]);
      setSelectedEmployeeId('');
      return;
    }

    const filtered = allEmployees.filter(emp =>
      emp.nome.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredEmployees(filtered.slice(0, 8));
    
    // Se o valor corresponde exatamente a um funcionário, selecioná-lo automaticamente
    const exactMatch = allEmployees.find(emp => 
      emp.nome.toLowerCase() === value.toLowerCase()
    );
    if (exactMatch) {
      setSelectedEmployeeId(exactMatch.id);
    } else {
      setSelectedEmployeeId('');
    }
  };

  // Selecionar funcionário da lista de sugestões
  const handleEmployeeSelect = (employee: { id: string; nome: string }) => {
    setSearchTerm(employee.nome);
    setSelectedEmployeeId(employee.id);
    setFilteredEmployees([]);
  };

  // Limpar busca
  const handleClearSearch = () => {
    setSearchTerm('');
    setSelectedEmployeeId('');
    setFilteredEmployees([]);
  };

  // Manipulação do filtro de mês
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month) {
      setDateRange({
        start_date: getFirstDayOfMonth(month),
        end_date: getLastDayOfMonth(month)
      });
    } else {
      setDateRange({
        start_date: formatDateForInput(currentMonthStart),
        end_date: formatDateForInput(currentMonthEnd)
      });
    }
  };

  const handleDateRangeChange = (newRange: typeof dateRange) => {
    setDateRange(newRange);
    
    // Atualizar mês selecionado se as datas estão no mesmo mês
    if (newRange.start_date && newRange.end_date) {
      const monthFromDate = getMonthFromDate(newRange.start_date);
      const monthToDate = getMonthFromDate(newRange.end_date);
      if (monthFromDate === monthToDate) {
        setSelectedMonth(monthFromDate);
      } else {
        setSelectedMonth('');
      }
    }
  };

  // Limpar filtros (incluindo mês)
  const handleClearFilters = () => {
    setDateRange({
      start_date: formatDateForInput(currentMonthStart),
      end_date: formatDateForInput(currentMonthEnd)
    });
    setSelectedMonth('');
    setStatusFilter('');
    handleClearSearch();
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
    return `${day}/${month}/${year} (${weekday})`;
  };

  const getStatusColor = (status: DailySummary['status']) => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'late':
        return 'warning';
      case 'extra':
        return 'info';
      case 'absent':
      case 'missing_exit':
        return 'error';
      case 'incomplete':
        return 'warning';
      case 'compensated':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: DailySummary['status']) => {
    const labels = {
      normal: 'Normal',
      late: 'Atraso',
      extra: 'Hora Extra',
      absent: 'Ausente',
      missing_exit: 'Sem Saída',
      incomplete: 'Incompleto',
      compensated: 'Compensado',
    };
    return labels[status] || status;
  };

  const formatHours = (hours: number | undefined) => {
    if (hours === undefined || hours === null || hours === 0) return '—';
    
    // Backend já converte para horas
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const exportToExcel = () => {
    if (summaries.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headerRows = [
      ['Período do relatório', `${formatDateLabel(dateRange.start_date) || 'Início'} até ${formatDateLabel(dateRange.end_date) || 'Fim'}`],
      []
    ];

    const dataRows = summaries.map(summary => ({
      'Data': formatDate(summary.date),
      'Funcionário': summary.employee_name,
      'Entrada': summary.first_entry_time || '—',
      'Saída': summary.last_exit_time || '—',
      'Horas Trabalhadas': formatHours(summary.worked_hours),
      'Status': getStatusLabel(summary.status),
    }));

    const worksheet = XLSX.utils.aoa_to_sheet(headerRows);
    XLSX.utils.sheet_add_json(worksheet, dataRows, {
      origin: 'A3',
      header: ['Data', 'Funcionário', 'Entrada', 'Saída', 'Horas Trabalhadas', 'Status'],
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros Diarios');

    const startLabel = formatDateForFilename(dateRange.start_date) || 'inicio';
    const endLabel = formatDateForFilename(dateRange.end_date) || 'fim';
    const filename = `Relatorio-(${startLabel}_a_${endLabel}).xlsx`;

    XLSX.writeFile(workbook, filename);
    toast.success('Registros exportados com sucesso!');
  };

  return (
    <Paper sx={{
      borderRadius: 2,
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      overflow: 'hidden'
    }}>
      {/* Seção de Filtros */}
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Filter size={20} color="rgba(255, 255, 255, 0.9)" />
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Filtros
          </Typography>
        </Box>

        {/* Primeira linha: Campo de busca */}
        <Box sx={{ mb: 3 }}>
          <Autocomplete
            freeSolo
            options={filteredEmployees.map(emp => emp.nome)}
            value={searchTerm}
            onInputChange={(event, value) => {
              handleSearchChange(value || '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                placeholder="Buscar por funcionário..."
                size="small"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'rgba(255, 255, 255, 0.9)',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                }}
              />
            )}
          />
        </Box>

        {/* Segunda linha: Mês, Período e Status */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
          {/* Mês */}
          <TextField
            label="Mês"
            type="month"
            value={selectedMonth || ''}
            onChange={(e) => handleMonthChange(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'rgba(255, 255, 255, 0.9)',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
            }}
          />

          {/* Período */}
          <Box>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, fontSize: '0.75rem' }}>
              Período de Consulta
            </Typography>
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              placeholder="Selecionar período dos registros"
              className="w-full"
            />
          </Box>

          {/* Status */}
          <TextField
            label="Status"
            select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'rgba(255, 255, 255, 0.9)',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
              '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.6)' },
            }}
          >
            <MenuItem value="">Todos os Status</MenuItem>
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="late">Atraso</MenuItem>
            <MenuItem value="extra">Hora Extra</MenuItem>
            <MenuItem value="absent">Ausente</MenuItem>
            <MenuItem value="missing_exit">Sem Saída</MenuItem>
            <MenuItem value="incomplete">Incompleto</MenuItem>
            <MenuItem value="compensated">Compensado</MenuItem>
          </TextField>
        </Box>

        {statusFilter && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Filtrando por status:
            </Typography>
            <Chip label={getStatusLabel(statusFilter)} color={getStatusColor(statusFilter)} size="small" sx={{ fontWeight: 500 }} />
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, mt: 3, alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="medium"
            onClick={handleClearFilters}
            startIcon={<ClearIcon />}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          >
            Limpar Filtros
          </Button>
          <Button
            variant="outlined"
            size="medium"
            onClick={exportToExcel}
            startIcon={<FileDownloadIcon />}
            disabled={summaries.length === 0}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
              '&.Mui-disabled': {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.3)',
              },
              ml: 'auto'
            }}
          >
            Exportar Excel
          </Button>
          <Button
            variant="outlined"
            size="medium"
            onClick={loadSummaries}
            startIcon={<RefreshCw size={16} />}
            sx={{ 
              ml: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          >
            Atualizar
          </Button>
        </Box>

      </Box>

      {/* Linha divisória */}
      <Box sx={{ 
        height: '1px', 
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
        my: 0
      }} />

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
              <TableCell align="center" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Status do Dia</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  <Typography variant="body2" sx={{ mt: 2, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Carregando registros...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    Nenhum registro encontrado
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              summaries.map((summary) => (
                <TableRow
                  key={`${summary.employee_id}-${summary.date}`}
                  sx={{
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
                    cursor: 'default',
                  }}
                >
                  {/* Data */}
                  <TableCell>
                    <Typography variant="body2" fontWeight={500} sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {formatDate(summary.date)}
                    </Typography>
                  </TableCell>

                  {/* Funcionário (Clicável) */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        onClick={() => handleEmployeeClick(summary)}
                        sx={{
                          color: 'rgba(255, 255, 255, 0.9)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontWeight: 500,
                          '&:hover': { color: 'rgba(255, 255, 255, 1)' },
                        }}
                      >
                        {summary.employee_name}
                      </Typography>

                      {/* Ícones de Alerta */}
                      {summary.missing_exit && (
                        <Tooltip title="Saída não registrada">
                          <Box component="span" sx={{ display: 'inline-flex' }}>
                            <AlertTriangle size={16} color="#ef4444" />
                          </Box>
                        </Tooltip>
                      )}
                      {summary.has_location_issues && (
                        <Tooltip title="Batidas fora do local autorizado">
                          <Box component="span" sx={{ display: 'inline-flex' }}>
                            <MapPin size={16} color="#f59e0b" />
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>

                  {/* Entrada */}
                  <TableCell align="center">
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {summary.first_entry_time || '—'}
                    </Typography>
                  </TableCell>

                  {/* Saída */}
                  <TableCell align="center">
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {summary.last_exit_time || '—'}
                    </Typography>
                  </TableCell>

                  {/* Horas Trabalhadas */}
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={500} sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {formatHours(summary.worked_hours)}
                    </Typography>
                  </TableCell>

                  {/* Status */}
                  <TableCell align="center">
                    <Chip
                      label={getStatusLabel(summary.status)}
                      color={getStatusColor(summary.status)}
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal de Detalhes */}
      <TimeRecordsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        summary={selectedSummary}
        records={modalRecords}
        loading={modalLoading}
      />
    </Paper>
  );
};

export default DailyRecordsTable;
