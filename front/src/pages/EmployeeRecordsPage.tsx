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
  Email as EmailIcon,
  FileDownload as FileDownloadIcon,
  AccessTime as AccessTimeIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
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
  
  // Estados para dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<TimeRecord | null>(null);
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
      const params: any = { funcionario_id: employeeId };
      
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
        
        if (reg.tipo === 'entrada') {
          entrada = dataHora;
        } else if (reg.tipo === 'saída' && entrada) {
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
        wsData.push([
          date,
          time,
          getStatusText(record.tipo || 'entrada'),
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
      
      const fileName = `Historico_${selectedEmployee.nome.replace(/\s+/g, '_')}_${dateFrom ? dateFrom.split('-').reverse().join('-') : 'inicio'}_a_${dateTo ? dateTo.split('-').reverse().join('-') : 'fim'}.xlsx`;
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

  // Função para excluir registro
  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;

    try {
      setSubmitting(true);
      await apiService.deleteTimeRecord(recordToDelete.registro_id);
      showSnackbar('Registro excluído com sucesso!', 'error');
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      buscarRegistrosFuncionario();
    } catch (err: any) {
      console.error('Error deleting record:', err);
      showSnackbar('Erro ao excluir registro', 'error');
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
    return tipo === 'entrada' ? 'success' : 'error';
  };

  const getStatusText = (tipo: string) => {
    return tipo === 'entrada' ? 'Entrada' : 'Saída';
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  const handleBack = () => {
    navigate('/records');
  };

  // Effects
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
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<EmailIcon />}
            onClick={() => setEmailDialogOpen(true)}
            disabled={selectedEmployeeRecords.length === 0}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
              }
            }}
          >
            Enviar Email
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={exportEmployeeHistory}
            disabled={selectedEmployeeRecords.length === 0}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
              }
            }}
          >
            Exportar Excel
          </Button>
        </Box>
      </Box>

      {/* Filtros */}
      <RecordsFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClearFilters={clearFilters}
        nome=""
        onNomeChange={() => {}}
        opcoesNomes={[]}
        onBuscarNomes={() => {}}
        tabValue={0}
        isIndividualView={true}
      />

      {/* Tabela de registros individuais */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card 
          sx={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <CardContent>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                mb: 3,
                color: 'white',
                fontSize: '18px'
              }}
            >
              Histórico de Registros ({selectedEmployeeRecords.length})
            </Typography>
            
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
                    <TableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Ações
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedEmployeeRecords.length > 0 ? (
                    selectedEmployeeRecords.map((record, index) => {
                      const { date, time } = formatDateTime(record.data_hora || '');
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
                              label={getStatusText(record.tipo || 'entrada')}
                              color={getStatusColor(record.tipo || 'entrada') as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              onClick={() => {
                                if (record.registro_id) {
                                  setRecordToDelete(record);
                                  setDeleteDialogOpen(true);
                                }
                              }}
                              size="small"
                              sx={{
                                color: '#ef4444',
                                '&:hover': {
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                }
                              }}
                              disabled={!record.registro_id}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
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
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
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
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
            Confirmar Exclusão
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            Tem certeza que deseja excluir este registro de ponto?
          </Typography>
          <Typography variant="body2" sx={{ color: '#ef4444', mt: 2 }}>
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
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
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
            sx={{
              backgroundColor: '#ef4444',
              '&:hover': {
                backgroundColor: '#dc2626',
              }
            }}
          >
            {submitting ? 'Excluindo...' : 'Excluir'}
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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
              Enviar Relatório por Email
            </Typography>
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