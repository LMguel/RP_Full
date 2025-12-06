import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import PageLayout from '../sections/PageLayout';
import DailyRecordsTable from '../components/DailyRecordsTable';
import TimeRecordForm from '../components/TimeRecordForm';
import { apiService } from '../services/api';
import { Employee } from '../types';
import { toast } from 'react-hot-toast';

const DailyRecordsPage: React.FC = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await apiService.getEmployees();
        setEmployees(response.funcionarios || []);
      } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        toast.error('Erro ao carregar funcionários');
      }
    };

    fetchEmployees();
  }, []);

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
      toast.success('Registro adicionado com sucesso!');
      setFormOpen(false);
      setReloadToken((prev) => prev + 1);
    } catch (error) {
      console.error('Erro ao adicionar registro:', error);
      toast.error('Erro ao adicionar registro');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Registros Diários
            </h1>
          </div>
          <div>
            <button
              onClick={handleAddRecord}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-lg"
            >
              <AddIcon />
              Adicionar Registro
            </button>
          </div>
        </div>

        {/* Card com Glassmorphism */}
        <DailyRecordsTable reloadToken={reloadToken} />
      </div>

      <TimeRecordForm
        open={formOpen}
        onClose={handleCloseForm}
        onSubmit={handleSaveRecord}
        loading={submitting}
        employees={employees}
      />
    </PageLayout>
  );
};

export default DailyRecordsPage;
