import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CalendarMonth as CalendarIcon,
  TableChart as TableIcon,
  LockOutlined as LockIcon,
  FileDownload as ExportIcon,
  Tune as TuneIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const RH_COLOR = '#f472b6';

const TABS = [
  { label: 'Dashboard',     path: '/rh',               icon: <DashboardIcon sx={{ fontSize: 15 }} />, exact: true  },
  { label: 'Funcionários',  path: '/rh/funcionarios',  icon: <GroupIcon     sx={{ fontSize: 15 }} />, exact: false },
  { label: 'Competências',  path: '/rh/competencias',  icon: <CalendarIcon  sx={{ fontSize: 15 }} />, exact: false },
  { label: 'Pré-Folha',     path: '/rh/pre-folha',     icon: <TableIcon     sx={{ fontSize: 15 }} />, exact: false },
  { label: 'Fechamentos',   path: '/rh/fechamentos',   icon: <LockIcon      sx={{ fontSize: 15 }} />, exact: false },
  { label: 'Exportações',   path: '/rh/exportacoes',   icon: <ExportIcon    sx={{ fontSize: 15 }} />, exact: false },
  { label: 'Configurações', path: '/rh/configuracoes', icon: <TuneIcon      sx={{ fontSize: 15 }} />, exact: false },
];

const RHTabNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (tab: typeof TABS[0]) =>
    tab.exact ? pathname === tab.path : pathname.startsWith(tab.path);

  return (
    <Box sx={{ mb: 2.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
        <Box sx={{
          width: 32, height: 32,
          borderRadius: '9px',
          background: `linear-gradient(135deg, ${RH_COLOR}30, ${RH_COLOR}10)`,
          border: `1px solid ${RH_COLOR}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: 16 }}>💼</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 20, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            RH / Folha
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: 11.5 }}>
            Pré-fechamento de folha de pagamento
          </Typography>
        </Box>
        <Chip
          label="PLUS"
          size="small"
          sx={{
            ml: 'auto',
            bgcolor: `${RH_COLOR}18`,
            color: RH_COLOR,
            border: `1px solid ${RH_COLOR}35`,
            fontWeight: 700,
            fontSize: 9,
            height: 20,
            letterSpacing: '0.08em',
          }}
        />
      </Box>

      {/* Tab Bar */}
      <Box sx={{
        display: 'flex',
        gap: 0.5,
        p: 0.5,
        borderRadius: '12px',
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.07)',
        overflowX: 'auto',
        '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {TABS.map(tab => {
          const active = isActive(tab);
          return (
            <Box
              key={tab.path}
              onClick={() => navigate(tab.path)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.25,
                py: 0.7,
                borderRadius: '9px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.18s ease',
                background: active ? `linear-gradient(135deg, ${RH_COLOR}22, ${RH_COLOR}08)` : 'transparent',
                border: active ? `1px solid ${RH_COLOR}30` : '1px solid transparent',
                color: active ? RH_COLOR : 'rgba(255,255,255,0.42)',
                '&:hover': {
                  color: active ? RH_COLOR : 'rgba(255,255,255,0.7)',
                  background: active
                    ? `linear-gradient(135deg, ${RH_COLOR}28, ${RH_COLOR}10)`
                    : 'rgba(255,255,255,0.04)',
                },
              }}
            >
              {tab.icon}
              <Typography sx={{
                fontSize: 12.5,
                fontWeight: active ? 600 : 400,
                color: 'inherit',
                letterSpacing: '0.005em',
              }}>
                {tab.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default RHTabNav;
