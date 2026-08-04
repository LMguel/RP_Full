import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, CalendarMonth as CalendarIcon } from '@mui/icons-material';
import { usePeriodo } from '../contexts/PeriodoContext';

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface MonthNavigatorProps {
  /** Cor de destaque (acompanha a identidade visual de cada tela). */
  accentColor?: string;
}

/**
 * Seletor de mês grande e centralizado, compartilhado entre Registros e
 * Correções via PeriodoContext — trocar o mês aqui reflete nas duas telas.
 */
const MonthNavigator: React.FC<MonthNavigatorProps> = ({ accentColor = '#8b5cf6' }) => {
  const { ano, mes, avancarMes, voltarMes } = usePeriodo();

  const arrowSx = {
    color: 'rgba(255,255,255,0.55)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    width: { xs: 34, md: 38 },
    height: { xs: 34, md: 38 },
    transition: 'all 0.16s ease',
    '&:hover': {
      color: 'white',
      borderColor: `${accentColor}55`,
      background: `${accentColor}14`,
    },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 1.5, md: 2.5 },
        py: { xs: 1.5, md: 2 },
      }}
    >
      <Tooltip title="Mês anterior">
        <IconButton onClick={voltarMes} aria-label="Mês anterior" sx={arrowSx}>
          <ChevronLeftIcon sx={{ fontSize: { xs: 18, md: 20 } }} />
        </IconButton>
      </Tooltip>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: { xs: 190, md: 240 }, justifyContent: 'center' }}>
        <CalendarIcon sx={{ fontSize: { xs: 20, md: 24 }, color: accentColor, opacity: 0.85 }} />
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Box
            component="span"
            sx={{
              fontWeight: 800,
              fontSize: { xs: 21, md: 27 },
              letterSpacing: '-0.01em',
              color: 'white',
              textTransform: 'capitalize',
              lineHeight: 1,
            }}
          >
            {MESES_LABEL[mes - 1]}
          </Box>
          <Box component="span" sx={{ fontWeight: 600, fontSize: { xs: 16, md: 20 }, color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
            {ano}
          </Box>
        </Box>
      </Box>

      <Tooltip title="Próximo mês">
        <IconButton onClick={avancarMes} aria-label="Próximo mês" sx={arrowSx}>
          <ChevronRightIcon sx={{ fontSize: { xs: 18, md: 20 } }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default MonthNavigator;
