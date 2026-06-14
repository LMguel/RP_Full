import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Chip } from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  TrendingUp as ExtraIcon,
  TrendingDown as FaltaIcon,
  Summarize as FolhaIcon,
  CheckCircle as OkIcon,
  Warning as WarnIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import RHTabNav from '../components/RHTabNav';
import { payrollService, fmtBRL, fmtCompetencia, statusColor } from '../services/payrollService';
import type { RHDashboard } from '../types';

const RH_COLOR = '#f472b6';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay },
});

interface MetricCard {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

const RHDashboardPage: React.FC = () => {
  const [data, setData]     = useState<RHDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    payrollService.getDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const comp     = data?.competencia ?? '';
  const compLabel = comp ? fmtCompetencia(comp) : '—';

  const cards: MetricCard[] = [
    {
      label: 'Total Salários',
      value: data ? fmtBRL(data.total_salarios) : '—',
      sub:   `${compLabel} · base`,
      icon:  <MoneyIcon sx={{ fontSize: 18 }} />,
      color: '#10b981',
    },
    {
      label: 'Total Extras',
      value: data ? fmtBRL(data.total_extras) : '—',
      sub:   `${data?.com_extra ?? 0} funcionários`,
      icon:  <ExtraIcon sx={{ fontSize: 18 }} />,
      color: '#3b82f6',
    },
    {
      label: 'Descontos Falta',
      value: data ? fmtBRL(data.total_faltas) : '—',
      sub:   `${data?.com_falta ?? 0} funcionários`,
      icon:  <FaltaIcon sx={{ fontSize: 18 }} />,
      color: '#f87171',
    },
    {
      label: 'Folha Estimada',
      value: data ? fmtBRL(data.total_folha) : '—',
      sub:   'total pré-folha',
      icon:  <FolhaIcon sx={{ fontSize: 18 }} />,
      color: RH_COLOR,
      onClick: () => navigate('/rh/pre-folha'),
    },
    {
      label: 'Funcionários',
      value: data ? String(data.total_funcionarios) : '—',
      sub:   'na competência',
      icon:  <OkIcon sx={{ fontSize: 18 }} />,
      color: '#8b5cf6',
    },
    {
      label: 'Pendências RH',
      value: data ? String(data.com_falta + (data.total_funcionarios - data.funcionarios_fechados)) : '—',
      sub:   'itens a revisar',
      icon:  <WarnIcon sx={{ fontSize: 18 }} />,
      color: '#f59e0b',
      onClick: () => navigate('/rh/fechamentos'),
    },
  ];

  return (
    <Box>
      <RHTabNav />

      {/* Competência atual */}
      <motion.div {...fade(0)}>
        <Box sx={{
          mb: 2,
          p: '10px 16px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
              Competência atual:
            </Typography>
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 13 }}>
              {compLabel}
            </Typography>
            {data?.status_competencia && (
              <Chip
                label={data.status_competencia}
                size="small"
                sx={{
                  height: 18,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  bgcolor: `${statusColor(data.status_competencia)}18`,
                  color: statusColor(data.status_competencia),
                  border: `1px solid ${statusColor(data.status_competencia)}35`,
                }}
              />
            )}
          </Box>
          <Box
            onClick={() => navigate('/rh/competencias')}
            sx={{
              fontSize: 12,
              color: RH_COLOR,
              cursor: 'pointer',
              fontWeight: 600,
              '&:hover': { opacity: 0.7 },
            }}
          >
            Ver competências →
          </Box>
        </Box>
      </motion.div>

      {/* Cards grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={36} sx={{ color: RH_COLOR }} />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
          {cards.map((card, i) => (
            <motion.div key={card.label} {...fade(i * 0.05)}>
              <Card
                onClick={card.onClick}
                sx={{
                  cursor: card.onClick ? 'pointer' : 'default',
                  '&:hover': card.onClick ? { opacity: 0.88 } : {},
                }}
              >
                <CardContent sx={{ p: '14px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <Box sx={{ p: 0.6, borderRadius: '8px', bgcolor: card.color + '1e', color: card.color, display: 'flex' }}>
                      {card.icon}
                    </Box>
                    <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {card.label}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: 'white', lineHeight: 1.1, mb: 0.3 }}>
                    {card.value}
                  </Typography>
                  <Typography sx={{ fontSize: 10.5, color: card.color, opacity: 0.85 }}>
                    {card.sub}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </Box>
      )}

      {/* Quick actions */}
      {!loading && (
        <motion.div {...fade(0.35)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {[
              { label: 'Calcular Pré-Folha', sub: 'Processa todos os funcionários', path: '/rh/pre-folha', color: RH_COLOR },
              { label: 'Exportar para Contador', sub: 'Excel, CSV ou PDF', path: '/rh/exportacoes', color: '#3b82f6' },
            ].map(action => (
              <Card
                key={action.label}
                onClick={() => navigate(action.path)}
                sx={{
                  cursor: 'pointer',
                  background: `linear-gradient(90deg, ${action.color}12 0%, ${action.color}04 100%)`,
                  border: `1px solid ${action.color}22`,
                  '&:hover': {
                    border: `1px solid ${action.color}40`,
                    background: `linear-gradient(90deg, ${action.color}18 0%, ${action.color}07 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: '12px 16px !important', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 13 }}>{action.label}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.42)', mt: 0.25 }}>{action.sub}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 18, color: action.color }}>→</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </motion.div>
      )}
    </Box>
  );
};

export default RHDashboardPage;
