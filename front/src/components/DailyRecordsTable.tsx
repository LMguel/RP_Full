import React, { useState, useEffect } from 'react';
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
import { AlertTriangle, MapPin, Calendar, Filter, RefreshCw, X } from 'lucide-react';
import type { DailySummary, DailySummaryFilters } from '../types/dailySummary';
import { getDailySummaries, getDayDetails } from '../services/dailySummaryService';
import TimeRecordsModal from './TimeRecordsModal';
import { toast } from 'react-hot-toast';

const DailyRecordsTable: React.FC = () => {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<DailySummary | null>(null);
  const [modalRecords, setModalRecords] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Filtros
  const [filters, setFilters] = useState<DailySummaryFilters>({
    month: new Date().toISOString().slice(0, 7), // YYYY-MM atual
  });
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<DailySummary['status'] | ''>('');
  const [dateFilter, setDateFilter] = useState('');

  // Lista única de funcionários para o filtro
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);

  // Carregar dados
  useEffect(() => {
    loadSummaries();
  }, [filters]);

  const loadSummaries = async () => {
    setLoading(true);
    try {
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
      
      // Log de debug para verificar campos
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

      // Extrair lista única de funcionários e ordenar alfabeticamente
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
  };

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

  const handleApplyFilters = () => {
    const newFilters: DailySummaryFilters = {
      month: filters.month,
    };

    if (employeeFilter) newFilters.employee_id = employeeFilter;
    if (statusFilter) newFilters.status = statusFilter;
    if (dateFilter) newFilters.date = dateFilter;

    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setEmployeeFilter('');
    setStatusFilter('');
    setDateFilter('');
    setFilters({
      month: new Date().toISOString().slice(0, 7),
    });
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
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: DailySummary['status']) => {
    const labels = {
      normal: 'Normal',
      late: 'Atraso',
      extra: 'Extra',
      absent: 'Ausente',
      missing_exit: 'Sem Saída',
      incomplete: 'Incompleto',
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

  const formatMinutes = (minutes: number | undefined) => {
    if (minutes === undefined || minutes === null) return '—';
    
    const sign = minutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(minutes);
    const h = Math.floor(absMinutes / 60);
    const m = Math.round(absMinutes % 60);
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3 }}>
          {/* Mês */}
          <TextField
            label="Mês"
            type="month"
            value={filters.month || ''}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Calendar size={18} />
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

          {/* Funcionário */}
          <Autocomplete
            options={employees}
            getOptionLabel={(option) => option.name}
            value={employees.find((e) => e.id === employeeFilter) || null}
            onChange={(_, newValue) => setEmployeeFilter(newValue?.id || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Funcionário"
                size="small"
                placeholder="Digite para buscar..."
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
            sx={{ minWidth: 250 }}
            noOptionsText="Nenhum funcionário encontrado"
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />

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
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="late">Atraso</MenuItem>
            <MenuItem value="extra">Hora Extra</MenuItem>
            <MenuItem value="absent">Ausente</MenuItem>
            <MenuItem value="missing_exit">Sem Saída</MenuItem>
          </TextField>

          {/* Data Específica */}
          <TextField
            label="Data Específica"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
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
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
          <Button
            variant="contained"
            size="medium"
            onClick={handleApplyFilters}
            startIcon={<Filter size={16} />}
            sx={{
              background: '#3b82f6',
              '&:hover': { background: '#2563eb' },
            }}
          >
            Aplicar Filtros
          </Button>
          <Button
            variant="outlined"
            size="medium"
            onClick={handleClearFilters}
            startIcon={<X size={16} />}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          >
            Limpar
          </Button>
          <Button
            variant="outlined"
            size="medium"
            onClick={loadSummaries}
            startIcon={<RefreshCw size={16} />}
            sx={{ 
              ml: 'auto',
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
              <TableCell align="center" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Horas Previstas</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Diferença</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  <Typography variant="body2" sx={{ mt: 2, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Carregando registros...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
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

                  {/* Horas Previstas */}
                  <TableCell align="center">
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {formatHours(summary.expected_hours)}
                    </Typography>
                  </TableCell>

                  {/* Diferença */}
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        color:
                          summary.difference_minutes > 0
                            ? '#10b981'
                            : summary.difference_minutes < 0
                            ? '#ef4444'
                            : '#6b7280',
                      }}
                    >
                      {formatMinutes(summary.difference_minutes)}
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
