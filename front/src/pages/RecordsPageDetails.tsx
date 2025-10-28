/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
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
  Chip,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Collapse,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  FileDownload as FileDownloadIcon,
  Delete as DeleteIcon,
  AccessTime as AccessTimeIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { TimeRecord, Employee } from '../types';

// Função utilitária para formatar datas
const formatDateTime = (dateValue: any): string => {
  try {
    if (!dateValue) return 'Data não disponível';
    
    let date;
    
    // Se é um número (timestamp)
    if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      const dateStr = String(dateValue);
      
      // Formatos possíveis: 
      // "2024-03-15 14:30:00", "2024-03-15T14:30:00", "15/03/2024 14:30:00", "28-09-2025 10:22:00"
      if (dateStr.includes('T')) {
        // Formato ISO
        date = new Date(dateStr);
      } else if (dateStr.includes('/')) {
        // Formato brasileiro DD/MM/YYYY HH:MM:SS
        const [datePart, timePart = '00:00:00'] = dateStr.split(' ');
        const [day, month, year] = datePart.split('/');
        date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`);
      } else if (dateStr.includes('-') && dateStr.includes(' ')) {
        // Formato YYYY-MM-DD HH:MM:SS ou DD-MM-YYYY HH:MM:SS
        const [datePart, timePart = '00:00:00'] = dateStr.split(' ');
        const dateParts = datePart.split('-');
        
        if (dateParts[0].length === 4) {
          // YYYY-MM-DD format
          date = new Date(`${datePart} ${timePart}`);
        } else {
          // DD-MM-YYYY format
          const [day, month, year] = dateParts;
          date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`);
        }
      } else if (/^\d+$/.test(dateStr)) {
        // String que é só números (timestamp)
        date = new Date(parseInt(dateStr));
      } else {
        // Tentar formato padrão
        date = new Date(dateStr);
      }
    }
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      console.log('⚠️ Data inválida:', dateValue, 'tipo:', typeof dateValue);
      return String(dateValue); // Retorna apenas o valor original sem "Formato inválido:"
    }
    
    // Formatar em português brasileiro com / nas datas
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.error('Erro ao formatar data:', error, 'Valor:', dateValue);
    return String(dateValue); // Retorna apenas o valor original
  }
};

const RecordsDetailedPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { employeeId: paramEmployeeId, employeeName: paramEmployeeName } = useParams<{ employeeId: string; employeeName: string }>();

  // Estados principais
  const [tabValue, setTabValue] = useState(1); // 1 = Detalhado
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para busca unificada
  const [searchTerm, setSearchTerm] = useState(paramEmployeeName ? decodeURIComponent(paramEmployeeName) : '');
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(paramEmployeeId || '');
  
  // Estados para filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Efeito para capturar parâmetros de URL para filtros de data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateFromParam = urlParams.get('dateFrom');
    const dateToParam = urlParams.get('dateTo');
    
    if (dateFromParam) {
      setDateFrom(dateFromParam);
      console.log('📅 RecordsPageDetails: Aplicando filtro dateFrom da URL:', dateFromParam);
    }
    if (dateToParam) {
      setDateTo(dateToParam);
      console.log('📅 RecordsPageDetails: Aplicando filtro dateTo da URL:', dateToParam);
    }
  }, []);
  
  // Estados para ordenação
  const [sortBy, setSortBy] = useState<'funcionario' | 'data' | 'status'>('data');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Estados para dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<TimeRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Estados para snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // Função para buscar registros
  const buscarRegistros = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('A data de início não pode ser maior que a data de fim.');
      setRecords([]);
      setFilteredRecords([]);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Buscando TODOS os registros individuais de entrada/saída...');
      
      let allRecords: TimeRecord[] = [];
      
      try {
        // Estratégia 1: Buscar todos os funcionários e depois seus registros individuais
        console.log('📊 Buscando lista de funcionários...');
        const employeesResponse = await apiService.getEmployees();
        const employeesList = employeesResponse.funcionarios || [];
        console.log('👥 Funcionários encontrados:', employeesList.length);
        
        // Para cada funcionário, buscar TODOS os seus registros individuais
        for (const employee of employeesList) {
          try {
            console.log(`📊 Buscando registros individuais de: ${employee.nome}`);
            
            // Tentar diferentes parâmetros para buscar registros individuais
            const strategies = [
              { funcionario_id: employee.id, individual: true },
              { funcionario_id: employee.id, detailed: true },
              { funcionario_id: employee.id, type: 'individual' },
              { funcionario_id: employee.id }
            ];
            
            let employeeRecords = [];
            
            for (const params of strategies) {
              try {
                console.log(`  🔧 Tentando parâmetros:`, params);
                const response = await apiService.getTimeRecords(params);
                console.log(`  📋 Resposta:`, response);
                
                if (Array.isArray(response) && response.length > 0) {
                  // Verificar se são registros individuais (têm data_hora, tipo, etc.)
                  const hasIndividualData = response.some(record => 
                    record.data_hora && record.tipo && (record.tipo === 'entrada' || record.tipo === 'saída')
                  );
                  
                  if (hasIndividualData) {
                    employeeRecords = response;
                    console.log(`  ✅ Encontrados ${employeeRecords.length} registros individuais`);
                    break;
                  } else {
                    console.log(`  ⚠️ Resposta não contém registros individuais`);
                  }
                } else if (response && typeof response === 'object') {
                  // Verificar propriedades do objeto que podem conter registros
                  const possibleProps = ['registros', 'records', 'data', 'items', 'timeRecords', 'detalhes'];
                  for (const prop of possibleProps) {
                    if (Array.isArray(response[prop])) {
                      const hasIndividualData = response[prop].some(record => 
                        record.data_hora && record.tipo
                      );
                      if (hasIndividualData) {
                        employeeRecords = response[prop];
                        console.log(`  ✅ Encontrados registros em ${prop}:`, employeeRecords.length);
                        break;
                      }
                    }
                  }
                  if (employeeRecords.length > 0) break;
                }
              } catch (strategyError) {
                console.log(`  ❌ Erro com parâmetros ${JSON.stringify(params)}:`, strategyError);
              }
            }
            
            // Se encontrou registros, adicionar informações do funcionário e incluir na lista
            if (employeeRecords.length > 0) {
              const recordsWithEmployeeInfo = employeeRecords.map(record => ({
                ...record,
                funcionario_nome: record.funcionario_nome || employee.nome,
                funcionario_id: record.funcionario_id || employee.id,
                // Garantir que temos os campos necessários
                registro_id: record.registro_id || record.id || `${employee.id}_${record.data_hora || new Date().getTime()}`,
                tipo: record.tipo || 'entrada',
                data_hora: record.data_hora || record.timestamp || record.datetime,
                empresa_nome: record.empresa_nome || record.company || 'N/A'
              }));
              
              allRecords = [...allRecords, ...recordsWithEmployeeInfo];
              console.log(`✅ Adicionados ${recordsWithEmployeeInfo.length} registros de ${employee.nome}`);
            } else {
              console.log(`⚠️ Nenhum registro individual encontrado para ${employee.nome}`);
            }
            
          } catch (empErr) {
            console.log(`❌ Erro geral ao buscar registros de ${employee.nome}:`, empErr);
          }
        }
        
        console.log('📊 Total de registros individuais coletados:', allRecords.length);
        console.log('📋 Exemplos dos primeiros 3 registros:', allRecords.slice(0, 3));
        
        // Se não conseguimos encontrar registros individuais, tentar endpoint direto
        if (allRecords.length === 0) {
          console.log('🔄 Tentando endpoints diretos para registros individuais...');
          
          const directEndpoints = [
            '/api/registros/individuais',
            '/api/time-records/individual', 
            '/api/records/detailed',
            '/api/pontos/todos'
          ];
          
          for (const endpoint of directEndpoints) {
            try {
              console.log(`📊 Tentando endpoint: ${endpoint}`);
              const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${endpoint}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (response.ok) {
                const data = await response.json();
                console.log(`✅ Resposta de ${endpoint}:`, data);
                
                let records = [];
                if (Array.isArray(data)) {
                  records = data;
                } else if (data.registros && Array.isArray(data.registros)) {
                  records = data.registros;
                }
                
                if (records.length > 0 && records[0].data_hora && records[0].tipo) {
                  allRecords = records;
                  console.log(`✅ Encontrados ${allRecords.length} registros no endpoint ${endpoint}`);
                  break;
                }
              }
            } catch (endpointError) {
              console.log(`❌ Erro no endpoint ${endpoint}:`, endpointError);
            }
          }
        }
        
        // Se ainda não temos registros, tentar buscar do endpoint padrão e verificar estrutura
        if (allRecords.length === 0) {
          console.log('🔄 Fallback: buscando do endpoint padrão...');
          const fallbackResponse = await apiService.getTimeRecords();
          console.log('📊 Resposta fallback:', fallbackResponse);
          
          if (Array.isArray(fallbackResponse)) {
            // Se já é um array, usar direto
            allRecords = fallbackResponse;
          } else if (fallbackResponse && typeof fallbackResponse === 'object') {
            // Procurar arrays em todas as propriedades
            Object.keys(fallbackResponse).forEach(key => {
              if (Array.isArray(fallbackResponse[key])) {
                console.log(`📊 Encontrado array em ${key}:`, fallbackResponse[key].length);
                allRecords = [...allRecords, ...fallbackResponse[key]];
              }
            });
          }
        }
        
      } catch (fetchError) {
        console.error('❌ Erro ao buscar registros individuais:', fetchError);
      }
      
      // Ordenar por data/hora mais recente primeiro (SEMPRE)
      if (allRecords.length > 0) {
        allRecords.sort((a, b) => {
          const dateA = new Date(a.data_hora || '1970-01-01');
          const dateB = new Date(b.data_hora || '1970-01-01');
          return dateB.getTime() - dateA.getTime(); // Mais recente primeiro
        });
        console.log('✅ Registros ordenados por data (mais recentes primeiro)');
        console.log('📅 Primeiro registro (mais recente):', allRecords[0]?.data_hora);
        console.log('📅 Último registro (mais antigo):', allRecords[allRecords.length - 1]?.data_hora);
      }
      
      // Aplicar filtros se especificados
      if ((dateFrom || dateTo || selectedEmployeeId) && allRecords.length > 0) {
        console.log('🔧 Aplicando filtros...');
        console.log('📅 Filtros de data:', { dateFrom, dateTo });
        console.log('👤 Funcionário selecionado:', selectedEmployeeId);
        console.log('📊 Total de registros antes do filtro:', allRecords.length);
        
        let filteredRecords = [...allRecords];
        
        if (selectedEmployeeId) {
          filteredRecords = filteredRecords.filter(record => 
            record.funcionario_id === selectedEmployeeId
          );
          console.log(`📊 Após filtro por funcionário: ${filteredRecords.length}`);
        }
        
        if (dateFrom || dateTo) {
          filteredRecords = filteredRecords.filter(record => {
            if (!record.data_hora) return false;
            
            // Extrair apenas a parte da data (sem horário)
            let recordDateStr = record.data_hora.split(' ')[0] || record.data_hora.split('T')[0];
            
            // Converter data do registro para formato YYYY-MM-DD para comparação
            let recordDateForComparison: string;
            
            if (recordDateStr.includes('/')) {
              // Formato DD/MM/YYYY
              const [day, month, year] = recordDateStr.split('/');
              recordDateForComparison = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            } else if (recordDateStr.includes('-')) {
              const dateParts = recordDateStr.split('-');
              if (dateParts[0].length === 4) {
                // Já está em formato YYYY-MM-DD
                recordDateForComparison = recordDateStr;
              } else {
                // Formato DD-MM-YYYY
                const [day, month, year] = dateParts;
                recordDateForComparison = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            } else {
              // Formato desconhecido, tentar usar como está
              recordDateForComparison = recordDateStr;
            }
            
            console.log(`🔍 Comparando: Record=${recordDateStr} -> ${recordDateForComparison}, DateFrom=${dateFrom}, DateTo=${dateTo}`);
            
            if (dateFrom && recordDateForComparison < dateFrom) return false;
            if (dateTo && recordDateForComparison > dateTo) return false;
            
            return true;
          });
          console.log(`📊 Após filtro por data: ${filteredRecords.length}`);
        }
        
        // Reordenar após filtros para manter ordem cronológica
        filteredRecords.sort((a, b) => {
          const dateA = new Date(a.data_hora || '1970-01-01');
          const dateB = new Date(b.data_hora || '1970-01-01');
          return dateB.getTime() - dateA.getTime(); // Mais recente primeiro
        });
        
        allRecords = filteredRecords;
      }
      
      console.log('🎯 Registros finais para exibição:', allRecords.length);
      
      setRecords(allRecords);
      setFilteredRecords(allRecords);
      
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

  // Limpar busca
  const handleClearSearch = () => {
    setSearchTerm('');
    setSelectedEmployeeId('');
    setFilteredEmployees([]);
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

  // Exportar para Excel
  const exportToExcel = () => {
    const dataToExport = filteredRecords.map(record => ({
      'ID Registro': record.registro_id,
      'ID Funcionário': record.funcionario_id,
      'Nome Funcionário': record.funcionario_nome,
      'Data/Hora': formatDateTime(record.data_hora),
      'Tipo': record.tipo,
      'Empresa': record.empresa_nome,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros Detalhados');
    XLSX.writeFile(wb, 'registros_detalhados.xlsx');
    showSnackbar('Dados exportados para Excel com sucesso!', 'success');
  };

  // Adicionar/Editar Registro
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

  // Deletar Registro
  const handleDeleteClick = (record: TimeRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (recordToDelete && recordToDelete.registro_id) {
      setSubmitting(true);
      try {
        await apiService.deleteTimeRecord(recordToDelete.registro_id);
        showSnackbar('Registro excluído com sucesso!', 'error');
        setDeleteDialogOpen(false);
        buscarRegistros(); // Recarregar registros
      } catch (err) {
        console.error('Erro ao excluir registro:', err);
        showSnackbar('Erro ao excluir registro.', 'error');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  // Ordenação
  const handleSort = (column: 'funcionario' | 'data' | 'status') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  useEffect(() => {
    let sorted = [...records];
    if (sortBy === 'data') {
      sorted.sort((a, b) => {
        // Converter datas usando a mesma lógica da função formatDateTime
        const getDateFromRecord = (dateValue: any): Date => {
          if (!dateValue) return new Date('1970-01-01');
          
          if (typeof dateValue === 'number') {
            return new Date(dateValue);
          }
          
          const dateStr = String(dateValue);
          
          if (dateStr.includes('T')) {
            return new Date(dateStr);
          } else if (dateStr.includes('/')) {
            const [datePart, timePart = '00:00:00'] = dateStr.split(' ');
            const [day, month, year] = datePart.split('/');
            return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`);
          } else if (dateStr.includes('-') && dateStr.includes(' ')) {
            const [datePart, timePart = '00:00:00'] = dateStr.split(' ');
            const dateParts = datePart.split('-');
            
            if (dateParts[0].length === 4) {
              return new Date(`${datePart} ${timePart}`);
            } else {
              const [day, month, year] = dateParts;
              return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`);
            }
          } else if (/^\d+$/.test(dateStr)) {
            return new Date(parseInt(dateStr));
          } else {
            return new Date(dateStr);
          }
        };

        const dateA = getDateFromRecord(a.data_hora);
        const dateB = getDateFromRecord(b.data_hora);
        
        return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      });
    } else if (sortBy === 'funcionario') {
      sorted.sort((a, b) => {
        const nameA = a.funcionario_nome || '';
        const nameB = b.funcionario_nome || '';
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => {
        const statusA = a.tipo || '';
        const statusB = b.tipo || '';
        return sortOrder === 'asc' ? statusA.localeCompare(statusB) : statusB.localeCompare(statusA);
      });
    }
    setFilteredRecords(sorted);
  }, [sortBy, sortOrder, records]);

  // Renderização
  return (
    <PageLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ color: 'white' }}>Registros de Ponto Detalhados</Typography>
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
          if (newValue === 0) {
            navigate('/records'); // Navega de volta para a página de resumo
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
          isIndividualView={true}
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
                  Registros Individuais ({filteredRecords.length})
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={exportToExcel}
                  disabled={filteredRecords.length === 0}
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
                <Table aria-label="tabela de registros detalhados">
                  <TableHead>
                    <TableRow>
                      <TableCell 
                        onClick={() => handleSort('funcionario')} 
                        style={{ cursor: 'pointer' }}
                        sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}
                      >
                        Funcionário {sortBy === 'funcionario' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </TableCell>
                      <TableCell 
                        onClick={() => handleSort('data')} 
                        style={{ cursor: 'pointer' }}
                        sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}
                      >
                        Data/Hora {sortBy === 'data' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Tipo</TableCell>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Empresa</TableCell>
                      <TableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={5} 
                          align="center"
                          sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
                        >
                          <Box sx={{ py: 8 }}>
                            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1 }}>
                              Nenhum registro detalhado encontrado
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                              Ajuste os filtros para visualizar os registros
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.registro_id} hover>
                          <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                              {record.funcionario_nome}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography variant="body2">
                              {formatDateTime(record.data_hora)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Chip
                              label={record.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                              size="small"
                              sx={{ 
                                background: record.tipo === 'entrada' 
                                  ? 'rgba(34, 197, 94, 0.2)' 
                                  : 'rgba(239, 68, 68, 0.2)',
                                color: record.tipo === 'entrada' ? '#22c55e' : '#ef4444',
                                border: `1px solid ${record.tipo === 'entrada' 
                                  ? 'rgba(34, 197, 94, 0.3)' 
                                  : 'rgba(239, 68, 68, 0.3)'}`
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography variant="body2">
                              {record.empresa_nome || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton 
                              onClick={() => handleDeleteClick(record)}
                              size="small"
                              sx={{ 
                                color: '#ef4444',
                                '&:hover': {
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                }
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
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

        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{"Confirmar Exclusão"}</DialogTitle>
          <DialogContent>
            <Typography id="alert-dialog-description">
              Tem certeza que deseja excluir o registro de {recordToDelete?.funcionario_nome} em {formatDateTime(recordToDelete?.data_hora)} ({recordToDelete?.tipo})?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color="primary" disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" autoFocus disabled={submitting}>
              Excluir
            </Button>
          </DialogActions>
        </Dialog>

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

export default RecordsDetailedPage;