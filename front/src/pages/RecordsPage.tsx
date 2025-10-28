import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../sections/PageLayout';
import RecordsTabs from '../components/RecordsTabs';
import RecordsFilters from '../components/RecordsFilters';
import TimeRecordForm from '../components/TimeRecordForm';
import {
  Box,
  Typography,
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
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Employee } from '../types';

interface EmployeeSummary {
  funcionario_id: string;
  funcionario: string;
  funcionario_nome: string;
  horas_trabalhadas: number;
}



const RecordsSummaryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Estados principais
  const [tabValue, setTabValue] = useState(0); // 0 = Resumo
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
  
  // Estados para snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // Estados para o formulário de adicionar registro
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Função atualizada para formatar horas trabalhadas - INCLUINDO MINUTOS
  const formatHoursWorked = (horasValue: number | string): string => {
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

  // Função para processar registros individuais e calcular resumo por funcionário
  const processIndividualRecords = (records: any[]): EmployeeSummary[] => {
    if (!Array.isArray(records) || records.length === 0) {
      return [];
    }
    
    // Agrupar registros por funcionário
    const groupedByEmployee: { [key: string]: any[] } = {};
    
    records.forEach(record => {
      const employeeId = record.funcionario_id || record.employee_id || record.id_funcionario;
      if (employeeId) {
        if (!groupedByEmployee[employeeId]) {
          groupedByEmployee[employeeId] = [];
        }
        groupedByEmployee[employeeId].push(record);
      }
    });
    
    // Calcular horas trabalhadas para cada funcionário
    const summaries: EmployeeSummary[] = [];
    
    Object.keys(groupedByEmployee).forEach(employeeId => {
      const employeeRecords = groupedByEmployee[employeeId];
      const firstRecord = employeeRecords[0];
      
      // Calcular total de horas trabalhadas
      let totalMinutes = 0;
      
      // Agrupar por data para calcular horas por dia
      const recordsByDate: { [date: string]: any[] } = {};
      
      employeeRecords.forEach(record => {
        const date = record.data || record.date || record.data_hora?.split(' ')[0];
        if (date) {
          if (!recordsByDate[date]) {
            recordsByDate[date] = [];
          }
          recordsByDate[date].push(record);
        }
      });
      
      // Para cada data, calcular horas trabalhadas
      Object.keys(recordsByDate).forEach(date => {
        const dayRecords = recordsByDate[date].sort((a, b) => {
          const timeA = a.data_hora || a.hora || a.time;
          const timeB = b.data_hora || b.hora || b.time;
          return timeA.localeCompare(timeB);
        });
        
        let dayMinutes = 0;
        let entryTime: Date | null = null;
        
        dayRecords.forEach(record => {
          const recordTime = new Date(record.data_hora || record.hora || record.time);
          const recordType = record.tipo || record.type || record.action;
          
          if (recordType === 'entrada' || recordType === 'entry') {
            entryTime = recordTime;
          } else if ((recordType === 'saída' || recordType === 'exit') && entryTime) {
            const diffMs = recordTime.getTime() - entryTime.getTime();
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            dayMinutes += diffMinutes;
            entryTime = null; // Reset para próximo par entrada/saída
          }
        });
        
        totalMinutes += dayMinutes;
      });
      
      // Converter minutos para horas decimais
      const totalHours = totalMinutes / 60;
      
      summaries.push({
        funcionario_id: employeeId,
        funcionario: firstRecord.funcionario_nome || firstRecord.nome || firstRecord.employee_name || `Funcionário ${employeeId}`,
        funcionario_nome: firstRecord.funcionario_nome || firstRecord.nome || firstRecord.employee_name || `Funcionário ${employeeId}`,
        horas_trabalhadas: totalHours
      });
    });
    
    return summaries;
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

      const response = await apiService.getTimeRecords(params);
      console.log('📊 Resposta da API:', response);
      
      let summaries: EmployeeSummary[] = [];
      
      // Verificar se a resposta já é um resumo ou são registros individuais
      if (Array.isArray(response)) {
        // Se já vem como resumo com horas_trabalhadas
        if (response.length > 0 && response[0].hasOwnProperty('horas_trabalhadas')) {
          summaries = response;
        } else {
          // Se são registros individuais, precisamos calcular o resumo
          summaries = processIndividualRecords(response);
        }
      } else if (response && typeof response === 'object') {
        // Se vem como objeto com propriedade que contém os dados
        if (response.resumo) {
          summaries = response.resumo;
        } else if (response.registros) {
          summaries = processIndividualRecords(response.registros);
        } else {
          summaries = [];
        }
      }
      
      setEmployeeSummaries(summaries);
      
    } catch (err: any) {
      console.error('❌ Erro geral ao buscar registros:', err);
      setError('Erro ao carregar registros. Tente novamente.');
      showSnackbar('Erro ao carregar registros', 'error');
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

  // Efeitos
  useEffect(() => {
    buscarRegistros();
  }, [buscarRegistros, tabValue]); // tabValue é mantido para consistência, mas sempre será 0 aqui

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
      'Horas Trabalhadas': formatHoursWorked(summary.horas_trabalhadas || 0),
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo de Registros');
    XLSX.writeFile(wb, 'resumo_registros.xlsx');
    showSnackbar('Dados exportados para Excel com sucesso!', 'success');
  };

  // Renderização
  return (
    <PageLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ color: 'white' }}>Registros de Ponto</Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddRecord}
          >
            Adicionar Registro
          </Button>
        </Box>

        <RecordsTabs tabValue={tabValue} onTabChange={(event, newValue) => {
          if (newValue === 1) {
            navigate('/records/detailed'); // Navega para a nova rota de registros detalhados
          } else {
            setTabValue(newValue);
          }
        }} />

        <RecordsFilters
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearFilters={() => {
            setDateFrom('');
            setDateTo('');
            handleClearSearch();
          }}
          nome={searchTerm}
          onNomeChange={handleSearchChange}
          opcoesNomes={filteredEmployees.map(emp => emp.nome)}
          onBuscarNomes={handleSearchChange}
          tabValue={tabValue}
          isIndividualView={false}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>
        ) : (
          <Card 
            sx={{
              mt: 4,
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: 'white',
                    fontSize: '18px'
                  }}
                >
                  Resumo por Funcionário ({employeeSummaries.length})
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={exportToExcel}
                  disabled={employeeSummaries.length === 0}
                  sx={{
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    }
                  }}
                >
                  Exportar para Excel
                </Button>
              </Box>
              <TableContainer 
                component={Paper} 
                variant="outlined"
                sx={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Table aria-label="tabela de resumo de registros">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Funcionário</TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Horas Trabalhadas</TableCell>
                      <TableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Ações</TableCell>
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
                      employeeSummaries.map((summary) => (
                        <TableRow key={summary.funcionario_id} hover>
                          <TableCell component="th" scope="row" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                              {summary.funcionario_nome || summary.funcionario}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {formatHoursWorked(summary.horas_trabalhadas || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleClickFuncionario(summary)}
                              sx={{
                                borderColor: 'rgba(59, 130, 246, 0.3)',
                                color: '#3b82f6',
                                '&:hover': {
                                  borderColor: '#3b82f6',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                }
                              }}
                            >
                              Ver Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

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
      </motion.div>
    </PageLayout>
  );
};

export default RecordsSummaryPage;