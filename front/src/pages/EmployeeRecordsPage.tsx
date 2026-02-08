import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../sections/PageLayout';
import RecordsFilters from '../components/RecordsFilters';
import {
  Box,
  Typography,
  IconButton,
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  Email as EmailIcon,
  FileDownload as FileDownloadIcon,
  AccessTime as AccessTimeIcon,
  Close as CloseIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { InputAdornment, Tooltip, Popover } from '@mui/material';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { apiService } from '../services/api';
import { TimeRecord, Employee } from '../types';

interface EmployeeWithRecords extends Employee {
  registros?: TimeRecord[];
  totalHoras?: string;
  ultimoRegistro?: TimeRecord;
}

const EmployeeRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { employeeId, employeeName } = useParams<{ employeeId: string; employeeName: string }>();
  
  // Estados principais
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithRecords | null>(null);
  const [selectedEmployeeRecords, setSelectedEmployeeRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  
  // Estados para dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<TimeRecord | null>(null);
  const [invalidateJustificativa, setInvalidateJustificativa] = useState('');
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [recordToAdjust, setRecordToAdjust] = useState<TimeRecord | null>(null);
  const [adjustData, setAdjustData] = useState({ date: '', time: '', tipo: 'entrada' as 'entrada' | 'saída', justificativa: '' });
  
  // Popover para exibir justificativa ao clicar no status
  const [justificativaAnchorEl, setJustificativaAnchorEl] = useState<HTMLElement | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [emailEnviando, setEmailEnviando] = useState(false);
  
  // Estados para snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // Função para buscar registros de um funcionário específico
  const buscarRegistrosFuncionario = useCallback(async () => {
    if (!employeeId) return;
    
    try {
      setLoading(true);
      const params: any = { employee_id: employeeId };
      
      if (dateFrom) params.inicio = dateFrom;
      if (dateTo) params.fim = dateTo;

      const response = await apiService.getTimeRecords(params);
      const records = Array.isArray(response) ? response : [];
      
      // Ordenar registros por data mais recente primeiro
      const sortedRecords = records.sort((a, b) => 
        new Date(b.data_hora || '').getTime() - new Date(a.data_hora || '').getTime()
      );
      
      setSelectedEmployeeRecords(sortedRecords);
      setSelectedEmployee({
        id: employeeId,
        nome: employeeName || 'Funcionário',
        cargo: '',
        foto_url: '',
        face_id: '',
        empresa_nome: '',
        empresa_id: '',
        data_cadastro: new Date().toISOString(),
        registros: sortedRecords,
        totalHoras: calcularTotalHoras(sortedRecords),
        ultimoRegistro: sortedRecords[0]
      });
      
    } catch (err: any) {
      console.error('Erro ao buscar registros do funcionário:', err);
      showSnackbar('Erro ao carregar histórico do funcionário', 'error');
    } finally {
      setLoading(false);
    }
  }, [employeeId, employeeName, dateFrom, dateTo]);

  // Função para calcular total de horas trabalhadas
  const calcularTotalHoras = (registros: TimeRecord[]): string => {
    if (registros.length === 0) return '00:00';
    
    let totalSegundos = 0;
    let entrada: Date | null = null;
    
    // Ordenar por data/hora para calcular corretamente
    const registrosOrdenados = [...registros].sort((a, b) => 
      new Date(a.data_hora || '').getTime() - new Date(b.data_hora || '').getTime()
    );
    
    registrosOrdenados.forEach(reg => {
      try {
        const dataHora = new Date(reg.data_hora || '');
        // Usar 'type' com fallback para 'tipo' (compatibilidade)
        const recordType = (reg.type || reg.tipo || '').toLowerCase();
        
        if (recordType === 'entrada') {
          entrada = dataHora;
        } else if ((recordType === 'saída' || recordType === 'saida') && entrada) {
          totalSegundos += (dataHora.getTime() - entrada.getTime()) / 1000;
          entrada = null;
        }
      } catch (error) {
        console.error('Erro ao processar registro:', error);
      }
    });
    
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
  };

  // Função para exportar histórico do funcionário específico
  const exportEmployeeHistory = () => {
    if (!selectedEmployee) return;

    try {
      const wb = XLSX.utils.book_new();
      
      // Dados para o worksheet
      const wsData = [
        [`Histórico de Registros - ${selectedEmployee.nome}`],
        ["Período:", `${dateFrom || 'Não informado'} a ${dateTo || 'Não informado'}`],
        ["Total de Registros:", selectedEmployeeRecords.length],
        ["Total de Horas Trabalhadas:", selectedEmployee.totalHoras || '00:00'],
        [],
        ["Data", "Hora", "Tipo", "ID Registro"]
      ];
      
      selectedEmployeeRecords.forEach(record => {
        const { date, time } = formatDateTime(record.data_hora || '');
        // Usar 'type' com fallback para 'tipo' (compatibilidade)
        const recordType = record.type || record.tipo || 'entrada';
        wsData.push([
          date,
          time,
          getStatusText(recordType),
          record.registro_id || 'N/A'
        ]);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Histórico");
      
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

      const startLabel = formatDateForFilename(dateFrom) || 'inicio';
      const endLabel = formatDateForFilename(dateTo) || 'fim';
      const fileName = `Relatorio-(${startLabel}_a_${endLabel}).xlsx`;
      XLSX.writeFile(wb, fileName);
      showSnackbar(`Histórico de ${selectedEmployee.nome} exportado com sucesso!`, 'success');
    } catch (err) {
      console.error('Erro ao exportar:', err);
      showSnackbar('Erro ao gerar relatório', 'error');
    }
  };

  // Função para enviar por email
  const enviarPorEmail = async () => {
    if (!emailDestino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) {
      showSnackbar('Por favor, insira um email válido', 'error');
      return;
    }

    if (!selectedEmployee) return;

    setEmailEnviando(true);
    try {
      console.log(`Enviando relatório de ${selectedEmployee.nome} para ${emailDestino}`);
      
      // Aqui você pode implementar a chamada real da API quando necessário
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simular delay
      
      showSnackbar('Relatório enviado com sucesso!', 'success');
      setEmailDialogOpen(false);
      setEmailDestino('');
    } catch (err) {
      console.error('Erro ao enviar email:', err);
      showSnackbar('Erro ao enviar relatório', 'error');
    } finally {
      setEmailEnviando(false);
    }
  };

  // Função para invalidar registro (soft delete)
  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    if (!invalidateJustificativa.trim()) return;

    try {
      setSubmitting(true);
      await apiService.invalidateTimeRecord(recordToDelete.registro_id, invalidateJustificativa.trim());
      showSnackbar('Registro invalidado com sucesso!', 'success');
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      setInvalidateJustificativa('');
      buscarRegistrosFuncionario();
    } catch (err: any) {
      console.error('Error invalidating record:', err);
      showSnackbar('Erro ao invalidar registro', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Função para ajustar registro
  const handleAdjustClick = (record: TimeRecord) => {
    const recordType = (record.type || record.tipo || 'entrada').toLowerCase();
    let date = '';
    let time = '';
    if (record.data_hora) {
      const parts = record.data_hora.includes('T') ? record.data_hora.split('T') : record.data_hora.split(' ');
      date = parts[0] || '';
      time = (parts[1] || '').substring(0, 5);
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
    if (!adjustData.justificativa.trim() || !adjustData.date || !adjustData.time) return;
    setSubmitting(true);
    try {
      const formattedDateTime = `${adjustData.date} ${adjustData.time}:00`;
      await apiService.adjustTimeRecord(recordToAdjust.registro_id, {
        data_hora: formattedDateTime,
        tipo: adjustData.tipo,
        justificativa: adjustData.justificativa.trim(),
      });
      showSnackbar('Registro ajustado com sucesso!', 'success');
      setAdjustDialogOpen(false);
      setRecordToAdjust(null);
      buscarRegistrosFuncionario();
    } catch (err: any) {
      console.error('Error adjusting record:', err);
      const msg = err?.response?.data?.error || 'Erro ao ajustar registro';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Funções auxiliares
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  const formatDateTime = (dateTimeString: string) => {
    try {
      if (!dateTimeString) {
        return { date: 'N/A', time: 'N/A' };
      }
      
      let date, time;
      
      if (dateTimeString.includes(' ')) {
        [date, time] = dateTimeString.split(' ');
      } else if (dateTimeString.includes('T')) {
        [date, time] = dateTimeString.split('T');
        time = time.split('.')[0];
      } else {
        return { date: dateTimeString, time: '' };
      }
      
      if (date.includes('-')) {
        const parts = date.split('-');
        if (parts[0].length === 4) {
          const [year, month, day] = parts;
          date = `${day}/${month}/${year}`;
        } else {
          const [day, month, year] = parts;
          date = `${day}/${month}/${year}`;
        }
      }
      
      return { date, time: time || '' };
    } catch (error) {
      console.error('Error formatting date:', error, dateTimeString);
      return { date: dateTimeString, time: '' };
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
  const getDetailedStatus = (record: TimeRecord) => {
    const statuses: Array<{ text: string; color: string }> = [];

    // Entrada antecipada
    if (record.entrada_antecipada_minutos && record.entrada_antecipada_minutos > 0) {
      statuses.push({
        text: `Entrada ${record.entrada_antecipada_minutos} min antes`,
        color: '#93c5fd' // azul claro
      });
    }

    // Atraso
    if (record.atraso_minutos && record.atraso_minutos > 0) {
      statuses.push({
        text: `Atraso ${record.atraso_minutos} min`,
        color: '#ef4444' // vermelho
      });
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
        text: 'Pontual',
        color: '#10b981' // verde
      }];
    }

    return statuses;
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedMonth('');
  };

  const handleBack = () => {
    navigate('/records');
  };

  // Effects
  // Inicializar mês atual
  useEffect(() => {
    const currentMonth = getCurrentMonth();
    setSelectedMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (employeeId) {
      buscarRegistrosFuncionario();
    }
  }, [buscarRegistrosFuncionario]);

  if (loading) {
    return (
      <PageLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress sx={{ color: 'white' }} />
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { sm: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        mb: 4
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={handleBack}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 600, 
                  color: 'white', 
                  mb: 1,
                  fontSize: '28px'
                }}
              >
                Registros de {selectedEmployee?.nome}
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '16px'
                }}
              >
                Total de horas: {selectedEmployee?.totalHoras || '00:00'}
              </Typography>
            </Box>
          </Box>
        </motion.div>
        
      </Box>

      {/* Paper Unificado: Filtros + Tabela */}
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
            <FilterIcon sx={{ color: 'rgba(255, 255, 255, 0.9)' }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Filtros
            </Typography>
          </Box>

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
              onClick={clearFilters}
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
              startIcon={<EmailIcon />}
              onClick={() => setEmailDialogOpen(true)}
              disabled={selectedEmployeeRecords.length === 0}
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
                }
              }}
            >
              Enviar Email
            </Button>
            <Button
              variant="outlined"
              size="medium"
              startIcon={<FileDownloadIcon />}
              onClick={exportEmployeeHistory}
              disabled={selectedEmployeeRecords.length === 0}
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
              Histórico de Registros ({selectedEmployeeRecords.length})
            </Typography>
          </Box>

          <TableContainer sx={{ background: 'transparent' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Data
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Hora
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Tipo
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Status
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Ações
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedEmployeeRecords.length > 0 ? (
                    selectedEmployeeRecords.map((record, index) => {
                      const { date, time } = formatDateTime(record.data_hora || '');
                      // Usar 'type' com fallback para 'tipo' (compatibilidade)
                      const recordType = record.type || record.tipo || 'entrada';
                      return (
                        <TableRow key={record.registro_id || `record-${index}`} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                              {date}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                              {time}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusText(recordType)}
                              color={getStatusColor(recordType) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {/* Status do registro */}
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
                              {getDetailedStatus(record).map((status, idx) => (
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
                                        disabled={isInactive || !record.registro_id}
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
                                        onClick={() => {
                                          if (record.registro_id) {
                                            setRecordToDelete(record);
                                            setInvalidateJustificativa('');
                                            setDeleteDialogOpen(true);
                                          }
                                        }}
                                        size="small"
                                        disabled={isInactive || !record.registro_id}
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
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Box sx={{ py: 8 }}>
                          <AccessTimeIcon sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '4rem', mb: 2 }} />
                          <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1 }}>
                            Nenhum registro encontrado
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            Este funcionário ainda não possui registros de ponto no período selecionado
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
        </Box>
      </Paper>

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

      {/* Invalidate Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setInvalidateJustificativa(''); }}
        PaperProps={{
          sx: { 
            borderRadius: 2,
            background: 'rgba(30, 41, 138, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: 'white' }}>
          Invalidar Registro
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 1 }}>
            Tem certeza que deseja invalidar este registro de ponto?
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
            helperText="Obrigatório: informe por que este registro está sendo invalidado"
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
              '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.5)' },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => { setDeleteDialogOpen(false); setInvalidateJustificativa(''); }}
            disabled={submitting}
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteRecord}
            color="error"
            variant="contained"
            disabled={submitting || !invalidateJustificativa.trim()}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <BlockIcon />}
            sx={{
              backgroundColor: '#ef4444',
              '&:hover': {
                backgroundColor: '#dc2626',
              }
            }}
          >
            {submitting ? 'Invalidando...' : 'Invalidar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Record Dialog */}
      <Dialog
        open={adjustDialogOpen}
        onClose={() => !submitting && setAdjustDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { 
            borderRadius: 2,
            background: 'rgba(30, 41, 138, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: 'white' }}>
          Ajustar Registro
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
            O registro original será marcado como AJUSTADO e um novo registro será criado com os dados corrigidos.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Nova Data"
                type="date"
                value={adjustData.date}
                onChange={(e) => setAdjustData(prev => ({ ...prev, date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' } },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                }}
              />
              <TextField
                label="Novo Horário"
                type="time"
                value={adjustData.time}
                onChange={(e) => setAdjustData(prev => ({ ...prev, time: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' } },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                }}
              />
            </Box>
            <TextField
              select
              label="Tipo"
              value={adjustData.tipo}
              onChange={(e) => setAdjustData(prev => ({ ...prev, tipo: e.target.value as 'entrada' | 'saída' }))}
              SelectProps={{ native: true }}
              sx={{
                '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' } },
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                '& option': { color: 'black' },
              }}
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
              helperText="Obrigatório: informe por que este registro está sendo ajustado"
              sx={{
                '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' } },
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.5)' },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setAdjustDialogOpen(false)}
            disabled={submitting}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAdjustConfirm}
            variant="contained"
            disabled={submitting || !adjustData.justificativa.trim() || !adjustData.date || !adjustData.time}
            sx={{ background: '#2563eb', '&:hover': { background: '#1d4ed8' } }}
          >
            {submitting ? 'Ajustando...' : 'Confirmar Ajuste'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Dialog */}
      <Dialog 
        open={emailDialogOpen} 
        onClose={() => !emailEnviando && setEmailDialogOpen(false)}
        PaperProps={{
          sx: { 
            borderRadius: 2,
            background: 'rgba(30, 41, 138, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box component="span">
              Enviar Relatório por Email
            </Box>
            <IconButton
              onClick={() => !emailEnviando && setEmailDialogOpen(false)}
              disabled={emailEnviando}
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Destinatário"
            type="email"
            fullWidth
            variant="outlined"
            value={emailDestino}
            onChange={(e) => setEmailDestino(e.target.value)}
            disabled={emailEnviando}
            sx={{ 
              mt: 2,
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-focused': {
                  color: 'rgba(255, 255, 255, 0.9)'
                }
              },
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.7)',
                },
                background: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          />
          {selectedEmployee && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Relatório de: {selectedEmployee.nome}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Registros: {selectedEmployeeRecords.length}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Período: {dateFrom || 'Não informado'} a {dateTo || 'Não informado'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setEmailDialogOpen(false)}
            disabled={emailEnviando}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={enviarPorEmail}
            disabled={emailEnviando || !emailDestino}
            color="primary"
            variant="contained"
            sx={{
              backgroundColor: '#2196f3',
              '&:hover': {
                backgroundColor: '#1976d2',
              }
            }}
          >
            {emailEnviando ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" />
                Enviando...
              </>
            ) : (
              <>
                <EmailIcon sx={{ mr: 1 }} />
                Enviar
              </>
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{
          marginLeft: '240px', // Espaço para o sidebar
          marginBottom: '20px',
          zIndex: 9999
        }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default EmployeeRecordsPage;