import React from 'react';
import { Box } from '@mui/material';
import RecordsSummaryPage from './RecordsPage';

// Registros Diários (DailyRecordsPage) e Registros Gerais (RecordsPageDetails)
// foram ocultados a pedido — só o Espelho de Ponto fica visível, para
// simplificar. As páginas continuam existindo no código, só não são
// renderizadas aqui.
const RecordsTabsPage: React.FC = () => {
  return (
    <Box>
      <RecordsSummaryPage />
    </Box>
  );
};

export default RecordsTabsPage;
