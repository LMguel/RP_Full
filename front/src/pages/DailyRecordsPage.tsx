import React from 'react';
import PageLayout from '../sections/PageLayout';
import DailyRecordsTable from '../components/DailyRecordsTable';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';

const DailyRecordsPage: React.FC = () => {
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
      </Box>

      <DailyRecordsTable />
    </PageLayout>
  );
};

export default DailyRecordsPage;
