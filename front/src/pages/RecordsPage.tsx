import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Autocomplete,
  InputAdornment,
  IconButton,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  FileDownload as FileDownloadIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { Filter } from 'lucide-react';
import TimeRecordForm from '../components/TimeRecordForm';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Employee } from '../types';

interface EmployeeSummary {
  funcionario_id: string;
  funcionario: string;
  funcionario_nome: string;
  horas_trabalhadas: number; // minutos
  horas_extras: number;      // minutos
  atrasos: number;           // minutos
}



const RecordsSummaryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Estados principais
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para busca unificada
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  
  // Estados para filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('A data de início não pode ser maior que a data de fim.');
      setEmployeeSummaries([]);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const params: {
        inicio?: string;
        fim?: string;
        funcionario_id?: string;
      } = {};
      
      if (dateFrom) params.inicio = dateFrom;
      if (dateTo) params.fim = dateTo;
      if (selectedEmployeeId) params.funcionario_id = selectedEmployeeId;

      // Usar o novo endpoint de resumo que calcula tudo no backend
      console.log('📊 [API] Buscando resumo com params:', params);
      const response = await apiService.getTimeRecordsSummary(params);
      console.log('📊 [API] Resposta do resumo:', response);
      
      let summaries: EmployeeSummary[] = [];
      
      // Processar resposta do endpoint de resumo
      if (Array.isArray(response)) {
        summaries = response.map((item: any) => ({
          funcionario_id: item.funcionario_id || item.id,
          funcionario: item.funcionario_nome || item.funcionario || item.nome || `Funcionário ${item.funcionario_id}`,
          funcionario_nome: item.funcionario_nome || item.funcionario || item.nome || `Funcionário ${item.funcionario_id}`,
          horas_trabalhadas: item.horas_trabalhadas_minutos || 0,
          horas_extras: item.horas_extras_minutos || 0,
          atrasos: item.atraso_minutos || 0,
        } as EmployeeSummary));
      }
      
      console.log('📊 [RESUMO] Summaries processados:', summaries);
      setEmployeeSummaries(summaries);
      
    } catch (err: any) {
      console.error('❌ Erro ao buscar resumo:', err);
      setError('Erro ao carregar resumo. Tente novamente.');
      showSnackbar('Erro ao carregar resumo', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedEmployeeId]);

  // Busca de funcionários conforme digita
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    
    if (!value.trim()) {
      setFilteredEmployees([]);
      setSelectedEmployeeId('');
      return;
    }

    const filtered = employees.filter(emp =>
      emp.nome.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredEmployees(filtered.slice(0, 8));
    
    // Se o valor corresponde exatamente a um funcionário, selecioná-lo automaticamente
    const exactMatch = employees.find(emp => 
      emp.nome.toLowerCase() === value.toLowerCase()
    );
    if (exactMatch) {
      setSelectedEmployeeId(exactMatch.id);
    } else {
      setSelectedEmployeeId('');
    }
  }, [employees]);

  // Selecionar funcionário da lista de sugestões
  const handleEmployeeSelect = (employee: Employee) => {
    setSearchTerm(employee.nome);
    setSelectedEmployeeId(employee.id);
    setFilteredEmployees([]); // Limpar sugestões após seleção
  };

  // Navegação via clique na tabela de resumo
  const handleClickFuncionario = (summary: EmployeeSummary) => {
    if (summary && summary.funcionario_id) {
      const funcionarioNome = summary.funcionario || summary.funcionario_nome || 'Funcionário';
      navigate(`/records/employee/${summary.funcionario_id}/${encodeURIComponent(funcionarioNome)}`);
    } else {
      showSnackbar('ID do funcionário não encontrado', 'error');
    }
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
      // Quando um mês é selecionado, definir as datas automaticamente
      setDateFrom(getFirstDayOfMonth(month));
      setDateTo(getLastDayOfMonth(month));
    } else {
      // Se mês for limpo, limpar também as datas
      setDateFrom('');
      setDateTo('');
    }
  };

  const handleDateFromChange = (date: string) => {
    setDateFrom(date);
    // Verificar se as datas são de meses diferentes
    if (date && dateTo) {
      const monthFrom = getMonthFromDate(date);
      const monthTo = getMonthFromDate(dateTo);
      if (monthFrom !== monthTo) {
        setSelectedMonth(''); // Limpar filtro de mês se datas são de meses diferentes
      } else if (monthFrom) {
        setSelectedMonth(monthFrom); // Definir mês se datas são do mesmo mês
      }
    }
  };

  const handleDateToChange = (date: string) => {
    setDateTo(date);
    // Verificar se as datas são de meses diferentes
    if (dateFrom && date) {
      const monthFrom = getMonthFromDate(dateFrom);
      const monthTo = getMonthFromDate(date);
      if (monthFrom !== monthTo) {
        setSelectedMonth(''); // Limpar filtro de mês se datas são de meses diferentes
      } else if (monthTo) {
        setSelectedMonth(monthTo); // Definir mês se datas são do mesmo mês
      }
    }
  };

  // Limpar filtros (incluindo mês)
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedMonth('');
    handleClearSearch();
  };

  // Efeitos
  useEffect(() => {
    buscarRegistros();
  }, [buscarRegistros]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await apiService.getEmployees();
        setEmployees(response.funcionarios || []);
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
    setDateFrom(getFirstDayOfMonth(currentMonth));
    setDateTo(getLastDayOfMonth(currentMonth));
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
    funcionario_id: string;
    data_hora: string;
    tipo: 'entrada' | 'saída';
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
  const exportToExcel = () => {
    const dataToExport = employeeSummaries.map(summary => ({
      'ID Funcionário': summary.funcionario_id,
      'Nome Funcionário': summary.funcionario_nome || summary.funcionario,
      'Horas Trabalhadas': formatMinutesToHHMM(summary.horas_trabalhadas || 0),
      'Horas Extras': formatMinutesToHHMM(summary.horas_extras || 0),
      'Atrasos': formatMinutesToHHMM(summary.atrasos || 0),
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo Funcionarios');
    XLSX.writeFile(wb, 'resumo_funcionarios.xlsx');
    showSnackbar('Resumo de funcionários exportado para Excel com sucesso!', 'success');
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
            <h1 className="text-3xl font-bold text-white">Registros de Ponto</h1>
            <button
              onClick={handleAddRecord}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-lg"
            >
              <AddIcon />
              Adicionar Registro
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

            {/* Segunda linha: Mês, Data Início e Data Fim */}
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

              {/* Data Início */}
              <TextField
                label="Data Início"
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
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

              {/* Data Fim */}
              <TextField
                label="Data Fim"
                type="date"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
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
                startIcon={<FileDownloadIcon />}
                onClick={exportToExcel}
                disabled={employeeSummaries.length === 0}
                sx={{
                  ml: 'auto',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '&.Mui-disabled': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  }
                }}
              >
                Exportar Excel
              </Button>
            </Box>
          </Box>

          {/* Linha divisória */}
          <Box sx={{ 
            height: '1px', 
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
            my: 0
          }} />

          {/* Seção da Tabela */}
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Horas Extras</TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Atrasos</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employeeSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={4} 
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
                        <TableRow key={summary.funcionario_id} hover>
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
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 500,
                                color: summary.horas_extras > 0 ? '#10b981' : 'rgba(255, 255, 255, 0.6)'
                              }}
                            >
                              {summary.horas_extras > 0 ? formatMinutesToHHMM(summary.horas_extras) : '00:00'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 500,
                                color: summary.atrasos > 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.6)'
                              }}
                            >
                              {summary.atrasos > 0 ? formatMinutesToHHMM(summary.atrasos) : '00:00'}
                            </Typography>
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