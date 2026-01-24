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
  TextField,
  Button,
  CircularProgress,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { Filter } from 'lucide-react';
import { DateRangePicker } from '../components/DateRangePicker';
import { getDailySummaries, getDayDetails } from '../services/dailySummaryService';
import TimeRecordsModal from './TimeRecordsModal';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

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

const DailyRecordsTable: React.FC<DailyRecordsTableProps> = ({ reloadToken = 0 }) => {
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const [dateRange, setDateRange] = useState({
    start_date: formatDateForInput(currentMonthStart),
    end_date: formatDateForInput(currentMonthEnd),
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmployees, setFilteredEmployees] = useState<Array<{ id: string; nome: string }>>([]);

  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalRecords, setModalRecords] = useState<any[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<any | null>(null);

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

      const normalized = response.summaries.map((s: any) => ({
        employee_id: s.employee_id || s.funcionario_id || s.id,
        employee_name: s.employee_name || s.nome || s.name,
        date: s.date || s.data,
        first_entry_time: s.first_entry_time || s.hora_entrada || s.actual_start,
        last_exit_time: s.last_exit_time || s.hora_saida || s.actual_end,
        worked_hours: s.worked_hours || s.horas_trabalhadas || 0,
        raw: s,
      }));

      setSummaries(normalized);
      const uniques = Array.from(new Map(normalized.map((n) => [n.employee_id, { id: n.employee_id, nome: n.employee_name }])).values());
      setFilteredEmployees(uniques.map(u => ({ id: u.id, nome: u.nome })));
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
    setSearchTerm('');
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
      Saída: s.last_exit_time || '-',
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
      {/* Filtros */}
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Filter size={20} color="rgba(255, 255, 255, 0.9)" />
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Filtros
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Autocomplete
            freeSolo
            options={filteredEmployees.map(e => e.nome)}
            value={searchTerm}
            onInputChange={(e, v) => setSearchTerm(v || '')}
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
                }}
              />
            )}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3, mb: 3 }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, fontSize: '0.75rem' }}>
              Período de Consulta
            </Typography>
            <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="medium"
            onClick={clearFilters}
            startIcon={<ClearIcon />}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': { borderColor: 'rgba(255, 255, 255, 0.5)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
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
              ml: 'auto',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': { borderColor: 'rgba(255, 255, 255, 0.5)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
              '&.Mui-disabled': { borderColor: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.3)' },
            }}
          >
            Exportar Excel
          </Button>
        </Box>
      </Box>

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
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  <Typography variant="body2" sx={{ mt: 2, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Carregando registros...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    Nenhum registro encontrado
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              summaries
                .filter(s => !searchTerm || s.employee_name.toLowerCase().includes(searchTerm.toLowerCase()))
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
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>{s.last_exit_time || '—'}</Typography>
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
