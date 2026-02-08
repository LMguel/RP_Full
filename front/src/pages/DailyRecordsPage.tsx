import React, { useState, useEffect, useRef } from 'react';
import PageLayout from '../sections/PageLayout';
import DailyRecordsTable from '../components/DailyRecordsTable';
import TimeRecordForm from '../components/TimeRecordForm';
import { Box, Typography, Snackbar, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import { apiService } from '../services/api';
import { Employee } from '../types';

const DailyRecordsPage: React.FC = () => {
  // Estados para o formulário de adicionar registro
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Estados para snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // Ref para forçar atualização da tabela
  const tableRef = useRef<{ refresh: () => void } | null>(null);

  // Buscar funcionários ao montar o componente
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await apiService.getEmployees();
        const employeesList = response.funcionarios || [];
        const sortedEmployees = [...employeesList].sort((a: Employee, b: Employee) =>
          (a.nome || '').localeCompare(b.nome || '')
        );
        setEmployees(sortedEmployees);
      } catch (err) {
        console.error('Erro ao buscar funcionários:', err);
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

  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // Handlers para o formulário
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
      // Atualizar a tabela
      if (tableRef.current?.refresh) {
        tableRef.current.refresh();
      }
      // Dispara evento para atualizar tabelas
      window.dispatchEvent(new CustomEvent('refreshDailyRecords'));
    } catch (err: any) {
      console.error('Erro ao adicionar registro:', err);
      const backendMsg = err?.response?.data?.mensagem || err?.response?.data?.error || err?.message || 'Erro ao adicionar registro.';
      showSnackbar(backendMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 4 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: 'white', mb: 1, fontSize: '28px' }}>
                Registros Diários
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>
                Visualize os registros por dia: Nome, Entrada e Saída
              </Typography>
            </Box>
          </Box>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <button
            onClick={handleAddRecord}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-lg"
          >
            + Adicionar Registro Manual
          </button>
        </motion.div>
      </Box>

      <DailyRecordsTable />

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
          marginLeft: '240px',
          marginBottom: '20px',
          zIndex: 9999
        }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default DailyRecordsPage;
