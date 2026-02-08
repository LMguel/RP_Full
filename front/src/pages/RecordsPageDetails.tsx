import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import PageLayout from '../sections/PageLayout';
import UnifiedRecordsFilter from '../components/UnifiedRecordsFilter';
import TimeRecordForm from '../components/TimeRecordForm';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Tooltip,
  Popover,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Block as BlockIcon,
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
  if (tipo === 'entrada') return 'success';
  return 'error';
};

const getStatusText = (tipo: string) => {
  const labels: Record<string, string> = {
    'entrada': 'Entrada',
    'saida': 'Saída',
    'saída': 'Saída',
    'intervalo_inicio': 'Saída Intervalo',
    'intervalo_fim': 'Volta Intervalo',
    'retorno': 'Volta Intervalo',
    'saida_antecipada': 'Saída Antecipada',
  };
  return labels[tipo.toLowerCase()] || (tipo === 'entrada' ? 'Entrada' : 'Saída');
};

// Função para determinar o status detalhado do registro
const getDetailedStatus = (record: TimeRecord, employees: Employee[], companySettings: any) => {
  const statuses: Array<{ text: string; color: string }> = [];

  // Entrada antecipada
  if (record.entrada_antecipada_minutos && record.entrada_antecipada_minutos > 0) {
    statuses.push({
      text: `Entrada ${record.entrada_antecipada_minutos} min antes`,
      color: '#93c5fd' // azul claro
    });
  }

  // Atraso: usar horario_entrada e tolerancia_atraso do funcionário se disponíveis
  // Buscar employee pelo estado React (employees)
  const employee = employees.find((e: Employee) => e.id === record.funcionario_id);
  // Preparar candidatos a horário padrão (entrada/saída) e função utilitária de extração
  const horarioEntradaCandidates = [
    employee && (employee as any).horario_entrada,
    (record as any).horario_padrao,
    (record as any).horario_previsto,
    (record as any).horario_agendado,
    companySettings && companySettings.horario_padrao
  ].filter(Boolean as any);

  const horarioSaidaCandidates = [
    employee && (employee as any).horario_saida,
    (record as any).horario_saida,
    (record as any).horario_padrao,
    companySettings && companySettings.horario_saida
  ].filter(Boolean as any);

  const extractTime = (value?: any): string | null => {
    if (value == null) return null;
    const s = String(value).trim();
    // Padrões: HH:MM, HH:MM:SS, HHhMM, dentro de datetime, com ',' etc.
    const m1 = s.match(/(\d{1,2})[:h](\d{2})/);
    if (m1) return `${m1[1].padStart(2, '0')}:${m1[2]}`;
    const m2 = s.match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (m2) return `${m2[1].padStart(2, '0')}:${m2[2]}`;
    const m3 = s.match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
    if (m3) return `${m3[4].padStart(2, '0')}:${m3[5]}`;
    const mt = s.match(/(\d{1,2}):(\d{2})/);
    if (mt) return `${mt[1].padStart(2, '0')}:${mt[2]}`;
    return null;
  };

  let horarioEntrada: string | null = null;
  for (const cand of horarioEntradaCandidates) {
    const t = extractTime(cand);
    if (t) { horarioEntrada = t; break; }
  }

  let horarioSaida: string | null = null;
  for (const cand of horarioSaidaCandidates) {
    const t = extractTime(cand);
    if (t) { horarioSaida = t; break; }
  }

  // Determinar tolerância: priorizar record.tolerancia, depois funcionário, depois configurações da empresa
  let toleranciaAtraso: number = 0;
  if (record && record.tolerancia != null && !isNaN(Number(record.tolerancia))) {
    toleranciaAtraso = Number(record.tolerancia);
  } else if (employee && employee.tolerancia_atraso != null && !isNaN(Number(employee.tolerancia_atraso))) {
    toleranciaAtraso = Number(employee.tolerancia_atraso);
  } else if (companySettings && companySettings.tolerancia_atraso != null && !isNaN(Number(companySettings.tolerancia_atraso))) {
    toleranciaAtraso = Number(companySettings.tolerancia_atraso);
  } else {
    toleranciaAtraso = 0;
  }
  // Garantir número finito
  if (!Number.isFinite(toleranciaAtraso)) toleranciaAtraso = 0;
  const isEntrada = (record.type || record.tipo || '').toLowerCase() === 'entrada';
  const isSaida = (record.type || record.tipo || '').toLowerCase() === 'saída' || (record.type || record.tipo || '').toLowerCase() === 'saida' || (record.type || record.tipo || '').toLowerCase() === 'saida_antecipada' || (record.type || record.tipo || '').toLowerCase() === 'saida';

  // Extrair horário real: preferir campo `horario_real`, senão tentar parsear `data_hora` (ISO, espaço ou timestamp)
  let horarioReal: string | null = null;
  if (record.horario_real) {
    const hrStr = String(record.horario_real);
    const m = hrStr.match(/(\d{1,2}):(\d{2})/);
    if (m) horarioReal = `${m[1].padStart(2, '0')}:${m[2]}`;
  }

  if (!horarioReal && record.data_hora) {
    const dataHoraStr = String(record.data_hora).trim();

    // ISO com 'T' (ex: 2024-03-15T07:50:00)
    if (dataHoraStr.includes('T')) {
      const parts = dataHoraStr.split('T');
      const timePart = parts[1] || '';
      const match = timePart.match(/(\d{1,2}):(\d{2})/);
      if (match) horarioReal = `${match[1].padStart(2, '0')}:${match[2]}`;
    } else if (dataHoraStr.includes(' ')) {
      // Formato com espaço entre data e hora
      const parts = dataHoraStr.split(' ');
      const timePart = parts[1] || parts[0];
      const match = timePart.match(/(\d{1,2}):(\d{2})/);
      if (match) horarioReal = `${match[1].padStart(2, '0')}:${match[2]}`;
    } else if (/^\d+$/.test(dataHoraStr)) {
      // Timestamp numérico
      const dt = new Date(parseInt(dataHoraStr));
      if (!isNaN(dt.getTime())) {
        const hh = String(dt.getHours()).padStart(2, '0');
        const mm = String(dt.getMinutes()).padStart(2, '0');
        horarioReal = `${hh}:${mm}`;
      }
    } else {
      // Tentativa genérica
      const match = dataHoraStr.match(/(\d{1,2}):(\d{2})/);
      if (match) horarioReal = `${match[1].padStart(2, '0')}:${match[2]}`;
    }
  }

  if (
    isEntrada &&
    horarioEntrada &&
    horarioReal &&
    Number.isFinite(toleranciaAtraso)
  ) {
    const [padraoH, padraoM] = horarioEntrada.split(':').map(Number);
    const [realH, realM] = horarioReal.split(':').map(Number);
    const padraoMin = (Number.isFinite(padraoH) ? padraoH : 0) * 60 + (Number.isFinite(padraoM) ? padraoM : 0);
    const realMin = (Number.isFinite(realH) ? realH : 0) * 60 + (Number.isFinite(realM) ? realM : 0);
    const desvio = realMin - padraoMin;
    // Log do cálculo
    console.log(`Registro ${record.registro_id || ''} | Funcionário: ${record.funcionario_nome || ''} | Horário padrão: ${horarioEntrada} | Horário real: ${horarioReal} | Tolerância usada: ${toleranciaAtraso} | Desvio: ${desvio} min`);

    if (desvio >= -toleranciaAtraso && desvio <= toleranciaAtraso) {
      // Dentro da janela de tolerância (-tolerancia .. +tolerancia)
      statuses.push({
        text: `Pontual`,
        color: '#10b981' // verde
      });
    } else if (desvio < -toleranciaAtraso) {
      // Entrada antecipada além da tolerância
      const antecipado = Math.abs(desvio) - toleranciaAtraso;
      statuses.push({
        text: `Entrada ${antecipado} min antes`,
        color: '#93c5fd' // azul claro
      });
    }
    // Atraso removido - não exibir status de atraso
  }

  // Tratar registros de saída: verificar saída antecipada em relação ao horário de saída
  if (isSaida && horarioSaida && horarioReal) {
    const [saidaH, saidaM] = horarioSaida.split(':').map(Number);
    const [realH2, realM2] = horarioReal.split(':').map(Number);
    const saidaMin = (Number.isFinite(saidaH) ? saidaH : 0) * 60 + (Number.isFinite(saidaM) ? saidaM : 0);
    const realMin2 = (Number.isFinite(realH2) ? realH2 : 0) * 60 + (Number.isFinite(realM2) ? realM2 : 0);
    const desvioSaida = saidaMin - realMin2; // >0 means left earlier

    // Preferir valores do backend quando disponíveis
    const saidaAntecipada = (record.saida_antecipada_minutos != null && !isNaN(Number(record.saida_antecipada_minutos)))
      ? Number(record.saida_antecipada_minutos)
      : Math.max(0, desvioSaida - toleranciaAtraso);

    if (saidaAntecipada > 0) {
      statuses.push({
        text: `Saiu ${saidaAntecipada} min antes`,
        color: '#f59e0b'
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

  // Remover statuses duplicados (mesmo texto), mantendo a primeira ocorrência
  const uniqueStatuses = statuses.filter((s, idx, self) => idx === self.findIndex(x => x.text === s.text));

  if ((globalThis as any).process?.env?.NODE_ENV !== 'production') {
    try {
      console.log('getDetailedStatus ->', record.registro_id || record.funcionario_id || '', 'statuses:', uniqueStatuses.map(s => s.text));
    } catch (e) {
      // ignore
    }
  }

  if (uniqueStatuses.length === 0) {
    return [{
      text: 'Pontual',
      color: '#10b981'
    }];
  }

  return uniqueStatuses;
};

const RecordsDetailedPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { employeeId: paramEmployeeId, employeeName: paramEmployeeName } = useParams<{ employeeId: string; employeeName: string }>();

  // Tipo simplificado para filtro de funcionário
  type EmployeeOption = { id: string; nome: string; cargo?: string };

  // Estados principais
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtros unificados
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  
  // Estados para filtros de data
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const [dateRange, setDateRange] = useState({
    start_date: currentMonthStart.toISOString().split('T')[0],
    end_date: currentMonthEnd.toISOString().split('T')[0]
  });
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
      setDateRange(prev => ({ ...prev, start_date: dateFromParam }));
      console.log('📅 RecordsPageDetails: Aplicando filtro dateFrom da URL:', dateFromParam);
    }
    if (dateToParam) {
      setDateRange(prev => ({ ...prev, end_date: dateToParam }));
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
  const [invalidateJustificativa, setInvalidateJustificativa] = useState('');
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [recordToAdjust, setRecordToAdjust] = useState<TimeRecord | null>(null);
  const [adjustData, setAdjustData] = useState({ date: '', time: '', tipo: 'entrada' as 'entrada' | 'saída', justificativa: '' });
  const [submitting, setSubmitting] = useState(false);
  
  // Popover para exibir justificativa ao clicar no status
  const [justificativaAnchorEl, setJustificativaAnchorEl] = useState<HTMLElement | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState('');
  
  // Estados para snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // Função para buscar registros
  const buscarRegistros = useCallback(async () => {
    if (dateRange.start_date && dateRange.end_date && dateRange.start_date > dateRange.end_date) {
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
      if (selectedEmployee?.id) {
        filtered = filtered.filter(record => record.funcionario_id === selectedEmployee.id);
      }
      if (dateRange.start_date || dateRange.end_date) {
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
          if (dateRange.start_date && recordDateForComparison < dateRange.start_date) return false;
          if (dateRange.end_date && recordDateForComparison > dateRange.end_date) return false;
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
  }, [dateRange.start_date, dateRange.end_date, selectedEmployee?.id]);

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
        
        // Se há um funcionário na URL, selecionar automaticamente
        if (paramEmployeeId && sortedEmployees.length > 0) {
          const foundEmployee = sortedEmployees.find((e: Employee) => e.id === paramEmployeeId);
          if (foundEmployee) {
            setSelectedEmployee(foundEmployee);
          }
        }
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
  }, [paramEmployeeId]);

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

    const reportStart = dateRange.start_date || (selectedMonth ? getFirstDayOfMonth(selectedMonth) : '');
    const reportEnd = dateRange.end_date || (selectedMonth ? getLastDayOfMonth(selectedMonth) : '');

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

      // Status detalhado
      let statusList = getDetailedStatus(record, employees, companySettings).map(s => s.text);

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
    justificativa: string;
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

  // Invalidar Registro (soft delete)
  const handleDeleteClick = (record: TimeRecord) => {
    setRecordToDelete(record);
    setInvalidateJustificativa('');
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (recordToDelete && recordToDelete.registro_id) {
      if (!invalidateJustificativa.trim()) {
        showSnackbar('Justificativa é obrigatória para invalidar um registro', 'warning');
        return;
      }
      setSubmitting(true);
      try {
        await apiService.invalidateTimeRecord(recordToDelete.registro_id, invalidateJustificativa.trim());
        showSnackbar('Registro invalidado com sucesso!', 'success');
        setDeleteDialogOpen(false);
        setInvalidateJustificativa('');
        buscarRegistros();
      } catch (err) {
        console.error('Erro ao invalidar registro:', err);
        showSnackbar('Erro ao invalidar registro.', 'error');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
    setInvalidateJustificativa('');
  };

  // Ajustar Registro
  const handleAdjustClick = (record: TimeRecord) => {
    const recordType = (record.type || record.tipo || 'entrada').toLowerCase();
    // Extrair data e hora do registro original
    let date = '';
    let time = '';
    if (record.data_hora) {
      const parts = record.data_hora.includes('T') ? record.data_hora.split('T') : record.data_hora.split(' ');
      date = parts[0] || '';
      time = (parts[1] || '').substring(0, 5);
      // Se data está em DD-MM-YYYY, converter para YYYY-MM-DD
      if (date.length === 10 && date[2] === '-') {
        const [d, m, y] = date.split('-');
        date = `${y}-${m}-${d}`;
      }
    }
    setRecordToAdjust(record);
    setAdjustData({
      date,
      time,
      tipo: (recordType === 'saída' || recordType === 'saida') ? 'saída' : 'entrada',
      justificativa: '',
    });
    setAdjustDialogOpen(true);
  };

  const handleAdjustConfirm = async () => {
    if (!recordToAdjust || !recordToAdjust.registro_id) return;
    if (!adjustData.justificativa.trim()) {
      showSnackbar('Justificativa é obrigatória para ajustar um registro', 'warning');
      return;
    }
    if (!adjustData.date || !adjustData.time) {
      showSnackbar('Data e hora são obrigatórias', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const formattedDateTime = `${adjustData.date} ${adjustData.time}:00`;
      await apiService.adjustTimeRecord(recordToAdjust.registro_id, {
        data_hora: formattedDateTime,
        tipo: adjustData.tipo,
        justificativa: adjustData.justificativa.trim(),
      });
      showSnackbar('Registro ajustado com sucesso! Um novo registro foi criado.', 'success');
      setAdjustDialogOpen(false);
      setRecordToAdjust(null);
      buscarRegistros();
    } catch (err: any) {
      console.error('Erro ao ajustar registro:', err);
      const msg = err?.response?.data?.error || 'Erro ao ajustar registro.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
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
          <button
            onClick={handleAddRecord}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-lg"
          >
            + Adicionar Registro Manual
          </button>
        </Box>

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
            onMonthChange={(month) => {
              setSelectedMonth(month);
              if (month) {
                setDateRange({
                  start_date: getFirstDayOfMonth(month),
                  end_date: getLastDayOfMonth(month)
                });
              }
            }}
            dateRange={dateRange}
            onDateRangeChange={(newRange) => {
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
            }}
            onClearFilters={() => {
              setDateRange({
                start_date: currentMonthStart.toISOString().split('T')[0],
                end_date: currentMonthEnd.toISOString().split('T')[0]
              });
              setSelectedMonth('');
              setSelectedEmployee(null);
            }}
            onExportExcel={exportToExcel}
            showExportButton={true}
            exportDisabled={filteredRecords.length === 0}
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
                              const chipColor = isEntrada ? '#22c55e' : '#ef4444';
                              const chipBg = isEntrada ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                              const chipBorder = isEntrada ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
                              return (
                            <Chip
                              label={getStatusText(recordType)}
                              size="small"
                              sx={{ 
                                background: chipBg,
                                color: chipColor,
                                border: `1px solid ${chipBorder}`
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
                              } else if (method === 'AJUSTE') {
                                label = 'Ajuste';
                                icon = '🔄';
                                bgColor = 'rgba(251, 191, 36, 0.2)';
                                textColor = '#fbbf24';
                                borderColor = 'rgba(251, 191, 36, 0.3)';
                              }
                              
                              const methodHasJustificativa = method === 'AJUSTE' && !!(record as any).justificativa;
                              return (
                                <Chip
                                  label={`${icon} ${label}`}
                                  size="small"
                                  onClick={methodHasJustificativa ? (e) => {
                                    setJustificativaTexto((record as any).justificativa);
                                    setJustificativaAnchorEl(e.currentTarget);
                                  } : undefined}
                                  sx={{ 
                                    background: bgColor,
                                    color: textColor,
                                    border: `1px solid ${borderColor}`,
                                    fontSize: '0.75rem',
                                    cursor: methodHasJustificativa ? 'pointer' : 'default',
                                  }}
                                />
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {/* Status do registro (ATIVO/AJUSTADO/INVALIDADO) */}
                              {(() => {
                                const recordStatus = (record as any).status || 'ATIVO';
                                let statusColor = '#10b981';
                                let statusBg = 'rgba(16, 185, 129, 0.15)';
                                if (recordStatus === 'AJUSTADO') {
                                  statusColor = '#f59e0b';
                                  statusBg = 'rgba(245, 158, 11, 0.15)';
                                } else if (recordStatus === 'INVALIDADO') {
                                  statusColor = '#ef4444';
                                  statusBg = 'rgba(239, 68, 68, 0.15)';
                                }
                                const hasJustificativa = !!(record as any).justificativa;
                                const isClickable = hasJustificativa && (recordStatus === 'INVALIDADO' || recordStatus === 'AJUSTADO');
                                return (
                                  <Chip
                                    label={recordStatus}
                                    size="small"
                                    onClick={isClickable ? (e) => {
                                      setJustificativaTexto((record as any).justificativa);
                                      setJustificativaAnchorEl(e.currentTarget);
                                    } : undefined}
                                    sx={{
                                      backgroundColor: statusBg,
                                      border: `1px solid ${statusColor}`,
                                      color: statusColor,
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      cursor: isClickable ? 'pointer' : 'default',
                                    }}
                                  />
                                );
                              })()}
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
                            {(() => {
                              const recordStatus = (record as any).status || 'ATIVO';
                              const isInactive = recordStatus === 'INVALIDADO' || recordStatus === 'AJUSTADO';
                              return (
                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                  <Tooltip title="Ajustar registro">
                                    <span>
                                      <IconButton
                                        onClick={() => handleAdjustClick(record)}
                                        size="small"
                                        disabled={isInactive}
                                        sx={{ 
                                          color: isInactive ? 'rgba(255,255,255,0.2)' : '#3b82f6',
                                          '&:hover': {
                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                          }
                                        }}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Invalidar registro">
                                    <span>
                                      <IconButton 
                                        onClick={() => handleDeleteClick(record)}
                                        size="small"
                                        disabled={isInactive}
                                        sx={{ 
                                          color: isInactive ? 'rgba(255,255,255,0.2)' : '#ef4444',
                                          '&:hover': {
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                          }
                                        }}
                                      >
                                        <BlockIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Box>
                              );
                            })()}
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
          <DialogTitle id="alert-dialog-title">{"Invalidar Registro"}</DialogTitle>
          <DialogContent>
            <Typography id="alert-dialog-description" sx={{ mb: 2 }}>
              Tem certeza que deseja invalidar o registro de {recordToDelete?.funcionario_nome} em {formatDateTime(recordToDelete?.data_hora)} ({recordToDelete?.tipo})?
            </Typography>
            <Typography variant="body2" sx={{ color: '#f59e0b', mb: 2 }}>
              O registro não será excluído, mas marcado como INVALIDADO.
            </Typography>
            <TextField
              fullWidth
              label="Justificativa *"
              placeholder="Informe o motivo da invalidação"
              value={invalidateJustificativa}
              onChange={(e) => setInvalidateJustificativa(e.target.value)}
              multiline
              rows={3}
              error={!invalidateJustificativa.trim() && submitting}
              helperText="Obrigatório: informe por que este registro está sendo invalidado"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color="primary" disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" autoFocus disabled={submitting || !invalidateJustificativa.trim()}>
              {submitting ? 'Invalidando...' : 'Invalidar'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog de Ajuste */}
        <Dialog
          open={adjustDialogOpen}
          onClose={() => !submitting && setAdjustDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Ajustar Registro</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              O registro original será marcado como AJUSTADO e um novo registro será criado com os dados corrigidos.
            </Typography>
            <Typography variant="body2" sx={{ mb: 3 }}>
              <strong>Registro original:</strong> {recordToAdjust?.funcionario_nome} - {formatDateTime(recordToAdjust?.data_hora)} ({recordToAdjust?.tipo})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Nova Data"
                  type="date"
                  value={adjustData.date}
                  onChange={(e) => setAdjustData(prev => ({ ...prev, date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Novo Horário"
                  type="time"
                  value={adjustData.time}
                  onChange={(e) => setAdjustData(prev => ({ ...prev, time: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
              </Box>
              <TextField
                select
                label="Tipo"
                value={adjustData.tipo}
                onChange={(e) => setAdjustData(prev => ({ ...prev, tipo: e.target.value as 'entrada' | 'saída' }))}
                SelectProps={{ native: true }}
              >
                <option value="entrada">Entrada</option>
                <option value="saída">Saída</option>
              </TextField>
              <TextField
                fullWidth
                label="Justificativa *"
                placeholder="Informe o motivo do ajuste"
                value={adjustData.justificativa}
                onChange={(e) => setAdjustData(prev => ({ ...prev, justificativa: e.target.value }))}
                multiline
                rows={3}
                error={!adjustData.justificativa.trim() && submitting}
                helperText="Obrigatório: informe por que este registro está sendo ajustado"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAdjustDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAdjustConfirm} 
              variant="contained" 
              disabled={submitting || !adjustData.justificativa.trim() || !adjustData.date || !adjustData.time}
              sx={{ background: '#2563eb' }}
            >
              {submitting ? 'Ajustando...' : 'Confirmar Ajuste'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Popover para justificativa */}
        <Popover
          open={Boolean(justificativaAnchorEl)}
          anchorEl={justificativaAnchorEl}
          onClose={() => setJustificativaAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{
            sx: {
              p: 2,
              maxWidth: 350,
              background: 'rgba(30, 41, 59, 0.97)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }
          }}
        >
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Justificativa
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 0.5 }}>
            {justificativaTexto}
          </Typography>
        </Popover>

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