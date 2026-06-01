import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import RecordsSummaryPage from './RecordsPage';
import DailyRecordsPage from './DailyRecordsPage';
import RecordsPageDetails from './RecordsPageDetails';

const TABS = [
  { key: 'espelho', label: 'Espelho de Ponto' },
  { key: 'diario',  label: 'Registros Diários' },
  { key: 'geral',   label: 'Registros Gerais' },
] as const;

type TabKey = typeof TABS[number]['key'];

const tabFromSearch = (search: string): number => {
  const key = new URLSearchParams(search).get('tab') as TabKey | null;
  const idx = key ? TABS.findIndex(t => t.key === key) : -1;
  return idx >= 0 ? idx : 0;
};

const RecordsTabsPage: React.FC = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const [active, setActive] = useState<number>(tabFromSearch(location.search));

  const handleSelect = (i: number) => {
    setActive(i);
    navigate(`/records?tab=${TABS[i].key}`, { replace: true });
  };

  return (
    <Box>
      {/* Barra de abas */}
      <Box
        sx={{
          display: 'flex',
          gap: 0,
          mb: 3,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          p: '4px',
          width: 'fit-content',
        }}
      >
        {TABS.map((tab, i) => {
          const isActive = active === i;
          return (
            <Box
              key={tab.key}
              component="button"
              onClick={() => handleSelect(i)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '9px',
                px: 2.5,
                py: 1,
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
                fontFamily: 'inherit',
                color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                '&:hover': {
                  color: 'white',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                },
              }}
            >
              {tab.label}
            </Box>
          );
        })}
      </Box>

      {/* Conteúdo */}
      {active === 0 && <RecordsSummaryPage />}
      {active === 1 && <DailyRecordsPage />}
      {active === 2 && <RecordsPageDetails />}
    </Box>
  );
};

export default RecordsTabsPage;
