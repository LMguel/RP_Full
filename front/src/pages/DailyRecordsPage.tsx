import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Download, FileText } from 'lucide-react';
import PageLayout from '../sections/PageLayout';
import DailyRecordsTable from '../components/DailyRecordsTable';
import { toast } from 'react-hot-toast';

const DailyRecordsPage: React.FC = () => {
  const handleExportExcel = () => {
    toast.success('Funcionalidade de exportação em breve');
    // TODO: Implementar exportação para Excel
  };

  const handleGenerateReport = () => {
    toast.success('Funcionalidade de relatório em breve');
    // TODO: Implementar geração de relatório PDF
  };

  return (
    <PageLayout>
      <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              📊 Registros Diários
            </h1>
            <p className="text-white/70 mt-1">
              Visualização consolidada por dia com filtros avançados
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerateReport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all font-semibold backdrop-blur"
            >
              <FileText size={18} />
              Gerar Relatório
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-lg"
            >
              <Download size={18} />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Card com Glassmorphism */}
        <DailyRecordsTable />
      </div>
    </PageLayout>
  );
};

export default DailyRecordsPage;
