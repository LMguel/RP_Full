import React from 'react';
import {
  Dialog, DialogContent, Box, Typography, Button, Chip,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { LABEL_TIPO, COR_TIPO, LABEL_PROXIMOS, COR_PROXIMOS, type TipoPendencia, type ResumoCorreções } from '../services/correctionsService';

interface Props {
  open: boolean;
  resumo: ResumoCorreções;
  onClose: () => void;
}

const TIPOS: TipoPendencia[] = [
  'saida_nao_registrada',
  'intervalo_incompleto',
  'sem_registros',
  'registros_excedentes',
  'quantidade_incorreta',
];

export default function PendenciasAlertModal({ open, resumo, onClose }: Props) {
  const navigate = useNavigate();

  const handleCorrigir = () => {
    onClose();
    navigate('/correcoes');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ elevation: 0 }}
    >
      <DialogContent>
        <Box sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
            <Box sx={{
              width: 56, height: 56,
              borderRadius: '16px',
              bgcolor: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <WarningIcon sx={{ fontSize: 28, color: '#f59e0b' }} />
            </Box>
          </Box>

          <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 18, textAlign: 'center', mb: 0.5 }}>
            Pendências encontradas
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', mb: 3 }}>
            {resumo.total} {resumo.total === 1 ? 'pendência' : 'pendências'} de ponto nos últimos 30 dias
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 3 }}>
            {TIPOS.filter(t => resumo[t] > 0).map(t => (
              <Box key={t} sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 1.5, py: 0.9,
                borderRadius: '9px',
                bgcolor: `${COR_TIPO[t]}12`,
                border: `1px solid ${COR_TIPO[t]}28`,
              }}>
                <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
                  {LABEL_TIPO[t]}
                </Typography>
                <Chip
                  label={resumo[t]}
                  size="small"
                  sx={{
                    bgcolor: `${COR_TIPO[t]}22`,
                    color: COR_TIPO[t],
                    fontWeight: 700, height: 20, fontSize: 11,
                    border: `1px solid ${COR_TIPO[t]}40`,
                    borderRadius: '6px',
                  }}
                />
              </Box>
            ))}
            {(resumo.proximos ?? 0) > 0 && (
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 1.5, py: 0.9,
                borderRadius: '9px',
                bgcolor: `${COR_PROXIMOS}12`,
                border: `1px solid ${COR_PROXIMOS}28`,
              }}>
                <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
                  {LABEL_PROXIMOS}
                </Typography>
                <Chip
                  label={resumo.proximos}
                  size="small"
                  sx={{
                    bgcolor: `${COR_PROXIMOS}22`,
                    color: COR_PROXIMOS,
                    fontWeight: 700, height: 20, fontSize: 11,
                    border: `1px solid ${COR_PROXIMOS}40`,
                    borderRadius: '6px',
                  }}
                />
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button fullWidth variant="outlined" onClick={onClose} sx={{ flex: 1 }}>
              Ignorar
            </Button>
            <Button
              fullWidth variant="contained" onClick={handleCorrigir}
              sx={{
                flex: 2,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
                '&:hover': { background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' },
              }}
            >
              Ver Correções
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
