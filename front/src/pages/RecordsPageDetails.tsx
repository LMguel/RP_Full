// Função utilitária para calcular atraso considerando tolerância
function calcularAtrasoComTolerancia(horarioPadrao: string, horarioReal: string, tolerancia: number): number {
  // Exemplo: horarioPadrao = '07:30', horarioReal = '07:41', tolerancia = 10
  const [padraoH, padraoM] = horarioPadrao.split(':').map(Number);
  const [realH, realM] = horarioReal.split(':').map(Number);
  const padraoMin = padraoH * 60 + padraoM;
  const realMin = realH * 60 + realM;
  const desvio = realMin - padraoMin;
  if (desvio <= tolerancia) return 0; // dentro da tolerância, sem atraso
  return desvio; // atraso integral a partir do horário de entrada
}
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
  CalendarMonth as CalendarIcon,
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

const getStatusColor = (tipo: string) => {
  return tipo === 'entrada' ? 'success' : 'error';
};

const getStatusText = (tipo: string) => {
  return tipo === 'entrada' ? 'Entrada' : 'Saída';
};

// Função para determinar o status detalhado do registro
const getDetailedStatus = (record: TimeRecord, employees: Employee[], companySettings: any) => {
  const statuses: Array<{ text: string; color: string }> = [];

  // Entrada antecipada
  if (record.entrada_antecipada_minutos && record.entrada_antecipada_minutos > 0) {
    statuses.push({
      text: `Entrada ${record.entrada_antecipada_minutos} min antes`,
      color: '#3b82f6' // azul
    });
  }

  // Atraso: usar horario_entrada e tolerancia_atraso do funcionário se disponíveis
  // Buscar employee pelo estado React (employees)
  const employee = employees.find((e: Employee) => e.id === record.funcionario_id);
  // Usar horario_entrada do funcionário e tolerancia_atraso da company
  const horarioEntrada = (employee && employee.horario_entrada) || record.horario_padrao;
  const toleranciaAtraso = companySettings && typeof companySettings.tolerancia_atraso === 'number'
    ? companySettings.tolerancia_atraso
    : (companySettings && typeof companySettings.tolerancia_atraso === 'string' ? parseInt(companySettings.tolerancia_atraso) : 0);
  const isEntrada = (record.type || record.tipo || '').toLowerCase() === 'entrada';
  
  // Extrair horário real do data_hora
  let horarioReal: string | null = null;
  if (record.data_hora) {
    const dataHoraStr = String(record.data_hora);
    const partes = dataHoraStr.split(' ');
    if (partes.length >= 2) {
      const horaParte = partes[1].split('T')[0] || partes[1]; // remover T se for ISO
      const horaMatch = horaParte.match(/^(\d{1,2}):(\d{2})/);
      if (horaMatch) {
        horarioReal = `${horaMatch[1].padStart(2, '0')}:${horaMatch[2]}`;
      }
    }
  }
  
  if (
    isEntrada &&
    horarioEntrada &&
    horarioReal &&
    typeof toleranciaAtraso === 'number'
  ) {
    const [padraoH, padraoM] = horarioEntrada.split(':').map(Number);
    const [realH, realM] = horarioReal.split(':').map(Number);
    const padraoMin = padraoH * 60 + padraoM;
    const realMin = realH * 60 + realM;
    const desvio = realMin - padraoMin;
    // Log do atraso calculado
    console.log(`Registro ${record.registro_id || ''} | Funcionário: ${record.funcionario_nome || ''} | Horário padrão: ${horarioEntrada} | Horário real: ${horarioReal} | Tolerância: ${toleranciaAtraso} | Atraso calculado: ${desvio} min`);
    // Preferir o valor de atraso já calculado no backend quando disponível
    // Caso contrário, calcular apenas o atraso além da tolerância (desvio - tolerância)
    const atrasoMinutos = (record.atraso_minutos != null)
      ? Number(record.atraso_minutos)
      : (desvio > toleranciaAtraso ? (desvio - toleranciaAtraso) : 0);

    if (atrasoMinutos > 0) {
      statuses.push({
        text: `Atraso ${atrasoMinutos} min (fora da tolerância)`,
        color: '#ef4444'
      });
    } else if (desvio > 0) {
      // Dentro da tolerância, não é considerado atraso
      statuses.push({
        text: `Pontual (dentro da tolerância)`,
        color: '#fbbf24'
      });
    }
  }

  // Hora extra
  if (record.horas_extras_minutos && record.horas_extras_minutos > 0) {
    statuses.push({
      text: `+${record.horas_extras_minutos} min extra`,
      color: '#10b981' // verde
    });
  }

  // Saída antecipada
  if (record.saida_antecipada_minutos && record.saida_antecipada_minutos > 0) {
    statuses.push({
      text: `Saiu ${record.saida_antecipada_minutos} min antes`,
      color: '#f59e0b' // laranja
    });
  }

  // Se não tem nenhum status especial
  if (statuses.length === 0) {
    return [{
      text: 'Normal',
      color: 'rgba(255, 255, 255, 0.6)' // cinza
    }];
  }

  return statuses;
};

const RecordsDetailedPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { employeeId: paramEmployeeId, employeeName: paramEmployeeName } = useParams<{ employeeId: string; employeeName: string }>();

  // Estados principais
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
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
  const [selectedMonth, setSelectedMonth] = useState('');
  
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
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}`;
  };
  
  // Inicializar mês atual
  useEffect(() => {
    const currentMonth = getCurrentMonth();
    setSelectedMonth(currentMonth);
  }, []);
  
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
      // Busca todos os registros de uma vez só
      const response = await apiService.getTimeRecords();
      let allRecords: TimeRecord[] = [];
      if (Array.isArray(response)) {
        allRecords = response;
      } else if (response && typeof response === 'object') {
        // Procurar arrays em todas as propriedades
        Object.keys(response).forEach(key => {
          if (Array.isArray(response[key])) {
            allRecords = [...allRecords, ...response[key]];
          }
        });
      }
      // Ordenar por data/hora mais recente primeiro
      if (allRecords.length > 0) {
        allRecords.sort((a, b) => {
          const dateA = new Date(a.data_hora || '1970-01-01');
          const dateB = new Date(b.data_hora || '1970-01-01');
          return dateB.getTime() - dateA.getTime();
        });
      }
      // Aplicar filtros se especificados
      let filtered = [...allRecords];
      if (selectedEmployeeId) {
        filtered = filtered.filter(record => record.funcionario_id === selectedEmployeeId);
      }
      if (dateFrom || dateTo) {
        filtered = filtered.filter(record => {
          if (!record.data_hora) return false;
          let recordDateStr = record.data_hora.split(' ')[0] || record.data_hora.split('T')[0];
          let recordDateForComparison: string;
          if (recordDateStr.includes('/')) {
            const [day, month, year] = recordDateStr.split('/');
            recordDateForComparison = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else if (recordDateStr.includes('-')) {
            const dateParts = recordDateStr.split('-');
            if (dateParts[0].length === 4) {
              recordDateForComparison = recordDateStr;
            } else {
              const [day, month, year] = dateParts;
              recordDateForComparison = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          } else {
            recordDateForComparison = recordDateStr;
          }
          if (dateFrom && recordDateForComparison < dateFrom) return false;
          if (dateTo && recordDateForComparison > dateTo) return false;
          return true;
        });
      }
      filtered.sort((a, b) => {
        const dateA = new Date(a.data_hora || '1970-01-01');
        const dateB = new Date(b.data_hora || '1970-01-01');
        return dateB.getTime() - dateA.getTime();
      });
      setRecords(filtered);
      setFilteredRecords(filtered);
    } catch (err: any) {
      console.error('❌ Erro ao buscar registros:', err);
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
    
    const fetchCompanySettings = async () => {
      try {
        const response = await apiService.getCompanySettings();
        setCompanySettings(response);
      } catch (err) {
        console.error('Erro ao buscar configurações da empresa:', err);
        // Não mostrar snackbar para configurações, usar valores padrão
      }
    };
    
    fetchEmployees();
    fetchCompanySettings();
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
    const formatDate = (value?: string) => {
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

    const formatDateForFilename = (value?: string) => {
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

    const reportStart = dateFrom || (selectedMonth ? getFirstDayOfMonth(selectedMonth) : '');
    const reportEnd = dateTo || (selectedMonth ? getLastDayOfMonth(selectedMonth) : '');

    const headerInfo = [
      ['Período do relatório', `${formatDate(reportStart) || 'Início'} até ${formatDate(reportEnd) || 'Fim'}`],
      []
    ];

    const dataToExport = filteredRecords.map(record => {
      const method = (record.method || 'MANUAL').toUpperCase();
      let methodLabel = 'Manual';
      if (method === 'CAMERA' || method === 'FACIAL') {
        methodLabel = 'Câmera';
      } else if (method === 'LOCATION' || method === 'LOCALIZACAO' || method === 'GPS') {
        methodLabel = 'Localização';
      }

      // Cálculo do atraso integral para exportação
      let atrasoExport = '';
      if (
        record.horario_padrao &&
        record.horario_real &&
        typeof record.tolerancia === 'number'
      ) {
        const atrasoIntegral = calcularAtrasoComTolerancia(record.horario_padrao, record.horario_real, record.tolerancia);
        if (atrasoIntegral > 0) {
          atrasoExport = `Atraso ${atrasoIntegral} min`;
        }
      } else if (record.atraso_minutos && record.atraso_minutos > 0) {
        atrasoExport = `Atraso ${record.atraso_minutos} min`;
      }

      // Status detalhado, substituindo atraso se necessário
      let statusList = getDetailedStatus(record, employees, companySettings).map(s => s.text);
      if (atrasoExport) {
        statusList = statusList.filter(s => !s.startsWith('Atraso'));
        statusList.unshift(atrasoExport);
      }

      return {
        'ID Registro': record.registro_id,
        'Nome Funcionário': record.funcionario_nome,
        'Data/Hora': formatDateTime(record.data_hora),
        'Tipo': record.type || record.tipo || '',
        'Método': methodLabel,
        'Status': statusList.join(', '),
      };
    });

    const ws = XLSX.utils.aoa_to_sheet(headerInfo);
    XLSX.utils.sheet_add_json(ws, dataToExport, {
      origin: 'A3',
      header: ['ID Registro', 'Nome Funcionário', 'Data/Hora', 'Tipo', 'Método', 'Status'],
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros Detalhados');
    const startLabel = formatDateForFilename(reportStart) || 'inicio';
    const endLabel = formatDateForFilename(reportEnd) || 'fim';
    const fileName = `Relatorio-(${startLabel}_a_${endLabel}).xlsx`;

    XLSX.writeFile(wb, fileName);
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
    employee_id: string;
    data_hora: string;
    tipo: 'entrada' | 'saída';
  }) => {
    setSubmitting(true);
    try {
      await apiService.registerTimeManual(recordData);
      showSnackbar('Registro adicionado com sucesso!', 'success');
      setFormOpen(false);
      buscarRegistros(); // Recarregar registros
    } catch (err: any) {
      console.error('Erro ao adicionar registro:', err);
      let backendMsg = err?.response?.data?.mensagem || err?.response?.data?.error || err?.message || 'Erro ao adicionar registro.';
      showSnackbar(backendMsg, 'error');
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
              <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.9)' }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                Filtros
              </Typography>
            </Box>

            {/* Primeira linha: Campo de busca */}
            <Box sx={{ mb: 3 }}>
              <TextField
                placeholder="Buscar funcionário..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                fullWidth
                size="small"
                InputProps={{
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
            </Box>

            {/* Segunda linha: Mês, Data Início e Data Fim */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
              {/* Mês */}
              <TextField
                label="Mês"
                type="month"
                value={selectedMonth || ''}
                onChange={(e) => {
                  const month = e.target.value;
                  setSelectedMonth(month);
                  if (month) {
                    setDateFrom(getFirstDayOfMonth(month));
                    setDateTo(getLastDayOfMonth(month));
                  } else {
                    setDateFrom('');
                    setDateTo('');
                  }
                }}
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
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  // Atualizar mês se mudou manualmente
                  if (e.target.value && dateTo) {
                    const monthFromDate = getMonthFromDate(e.target.value);
                    const monthToDate = getMonthFromDate(dateTo);
                    if (monthFromDate === monthToDate) {
                      setSelectedMonth(monthFromDate);
                    } else {
                      setSelectedMonth('');
                    }
                  }
                }}
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
                onChange={(e) => {
                  setDateTo(e.target.value);
                  // Atualizar mês se mudou manualmente
                  if (dateFrom && e.target.value) {
                    const monthFromDate = getMonthFromDate(dateFrom);
                    const monthToDate = getMonthFromDate(e.target.value);
                    if (monthFromDate === monthToDate) {
                      setSelectedMonth(monthFromDate);
                    } else {
                      setSelectedMonth('');
                    }
                  }
                }}
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
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setSelectedMonth('');
                  handleClearSearch();
                }}
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
                disabled={filteredRecords.length === 0}
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
                Registros Individuais ({filteredRecords.length})
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
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Método</TableCell>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Status</TableCell>
                      <TableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={6} 
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
                            <Typography 
                              variant="body2" 
                              onClick={() => navigate(`/records/employee/${record.funcionario_id}/${encodeURIComponent(record.funcionario_nome || '')}`)}
                              sx={{ 
                                fontWeight: 500, 
                                color: 'rgba(255, 255, 255, 0.9)',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                '&:hover': {
                                  color: 'rgba(255, 255, 255, 1)',
                                }
                              }}
                            >
                              {record.funcionario_nome}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Typography variant="body2">
                              {formatDateTime(record.data_hora)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            {(() => {
                              const recordType = (record.type || record.tipo || '').toLowerCase();
                              const isEntrada = recordType === 'entrada';
                              return (
                            <Chip
                              label={isEntrada ? 'Entrada' : 'Saída'}
                              size="small"
                              sx={{ 
                                background: isEntrada 
                                  ? 'rgba(34, 197, 94, 0.2)' 
                                  : 'rgba(239, 68, 68, 0.2)',
                                color: isEntrada ? '#22c55e' : '#ef4444',
                                border: `1px solid ${isEntrada 
                                  ? 'rgba(34, 197, 94, 0.3)' 
                                  : 'rgba(239, 68, 68, 0.3)'}`
                              }}
                            />
                              );
                            })()}
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            {(() => {
                              const method = (record.method || 'MANUAL').toUpperCase();
                              let label = 'Manual';
                              let icon = '✏️';
                              let bgColor = 'rgba(156, 163, 175, 0.2)';
                              let textColor = '#9ca3af';
                              let borderColor = 'rgba(156, 163, 175, 0.3)';
                              
                              if (method === 'CAMERA' || method === 'FACIAL') {
                                label = 'Câmera';
                                icon = '📷';
                                bgColor = 'rgba(139, 92, 246, 0.2)';
                                textColor = '#a78bfa';
                                borderColor = 'rgba(139, 92, 246, 0.3)';
                              } else if (method === 'LOCATION' || method === 'LOCALIZACAO' || method === 'GPS') {
                                label = 'Localização';
                                icon = '📍';
                                bgColor = 'rgba(59, 130, 246, 0.2)';
                                textColor = '#60a5fa';
                                borderColor = 'rgba(59, 130, 246, 0.3)';
                              }
                              
                              return (
                                <Chip
                                  label={`${icon} ${label}`}
                                  size="small"
                                  sx={{ 
                                    background: bgColor,
                                    color: textColor,
                                    border: `1px solid ${borderColor}`,
                                    fontSize: '0.75rem'
                                  }}
                                />
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {getDetailedStatus(record, employees, companySettings).map((status, idx) => (
                                <Chip
                                  key={idx}
                                  label={status.text}
                                  size="small"
                                  sx={{
                                    backgroundColor: 'transparent',
                                    border: `1px solid ${status.color}`,
                                    color: status.color,
                                    fontSize: '0.75rem',
                                  }}
                                />
                              ))}
                            </Box>
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