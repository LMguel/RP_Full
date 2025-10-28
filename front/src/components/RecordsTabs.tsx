import React from 'react';
import {
  Card,
  CardContent,
  Tabs,
  Tab,
} from '@mui/material';
import { motion } from 'framer-motion';

interface RecordsTabsProps {
  tabValue: number;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
}

const RecordsTabs: React.FC<RecordsTabsProps> = ({
  tabValue,
  onTabChange,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
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
          <Tabs 
            value={tabValue} 
            onChange={onTabChange} 
            sx={{ 
              mb: 2,
              '& .MuiTab-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
                textTransform: 'none',
                '&.Mui-selected': {
                  color: 'white',
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#3b82f6',
              }
            }}
          >
            <Tab label="Resumo por Funcionário" />
            <Tab label="Registros Detalhados" />
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RecordsTabs;