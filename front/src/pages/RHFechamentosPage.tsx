import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip,
  CircularProgress, Alert, Stepper, Step, StepLabel, StepContent,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  CheckCircle as CheckIcon,
  Warning as WarnIcon,
  Cancel as BlockIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import RHTabNav from '../components/RHTabNav';
import {
  payrollService, fmtBRL, fmtCompetencia,
  competenciaAtual, statusColor,
} from '../services/payrollService';
import type { Competencia, PreFolhaItem } from '../types';
import toast from 'react-hot-toast';

const RH_COLOR = '#f472b6';

interface Validation {
  label: string;
  ok: boolean;
  detail: string;
}

const RHFechamentosPage: React.FC = () => {
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [selectedComp, setSelectedComp] = useState('');
  const [items, setItems]               = useState<PreFolhaItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [closing, setClosing]           = useState(false);
  const [reopening, setReopening]       = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const comp   = params.get('comp') || competenciaAtual();
    payrollService.listCompetencias().then(r => {
      setCompetencias(r.competencias);
      const found = r.competencias.find(c => c.competencia === comp);
      setSelectedComp(found ? comp : r.competencias[0]?.competencia ?? comp);
    });
  }, [location.search]);

  useEffect(() => {
    if (!selectedComp) return;
    setLoading(true);
    payrollService.getPreFolha(selectedComp)
      .then(r => setItems(r.pre_folha))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedComp]);

  const compAtual = competencias.find(c => c.competencia === selectedComp);
  const isFechada = compAtual?.status === 'FECHADA';

  // Validações para fechar
  const validations: Validation[] = [
    {
      label: 'Pré-folha calculada',
      ok: items.length > 0,
      detail: items.length > 0
        ? `${items.length} funcionários calculados`
        : 'Calcule a pré-folha antes de fechar',
    },
    {
      label: 'Sem funcionários zerados',
      ok: items.every(i => i.total > 0),
      detail: items.every(i => i.total > 0)
        ? 'Todos com valor positivo'
        : `${items.filter(i => i.total <= 0).length} funcionário(s) com total R$ 0,00`,
    },
    {
      label: 'Competência aberta',
      ok: compAtual?.status === 'ABERTA',
      detail: compAtual?.status === 'ABERTA'
        ? 'Status: ABERTA'
        : `Status atual: ${compAtual?.status ?? '—'}`,
    },
  ];

  const canClose = validations.every(v => v.ok);

  const handleFechar = async () => {
    if (!canClose) return;
    setClosing(true);
    try {
      await payrollService.fechar(selectedComp);
      toast.success(`Competência ${fmtCompetencia(selectedComp)} fechada com sucesso`);
      const r = await payrollService.listCompetencias();
      setCompetencias(r.competencias);
    } catch {
      toast.error('Erro ao fechar competência');
    } finally { setClosing(false); }
  };

  const handleReabrir = async () => {
    setReopening(true);
    try {
      await payrollService.reabrir(selectedComp);
      toast.success(`Competência ${fmtCompetencia(selectedComp)} reaberta`);
      const r = await payrollService.listCompetencias();
      setCompetencias(r.competencias);
    } catch {
      toast.error('Erro ao reabrir competência');
    } finally { setReopening(false); }
  };

  const totalFolha = items.reduce((s, i) => s + i.total, 0);

  const sc = statusColor(compAtual?.status ?? '');

  return (
    <Box>
      <RHTabNav />

      {/* Seletor */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel sx={{ fontSize: 13 }}>Competência</InputLabel>
          <Select
            value={selectedComp}
            onChange={e => setSelectedComp(e.target.value)}
            label="Competência"
            sx={{ fontSize: 13 }}
          >
            {competencias.map(c => (
              <MenuItem key={c.competencia} value={c.competencia}>
                {fmtCompetencia(c.competencia)}
                <Chip
                  label={c.status}
                  size="small"
                  sx={{ ml: 1, height: 16, fontSize: 9.5, bgcolor: statusColor(c.status) + '18', color: statusColor(c.status) }}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {compAtual && (
          <Chip label={compAtual.status} size="small"
            sx={{ bgcolor: sc + '18', color: sc, border: `1px solid ${sc}35`, fontWeight: 700, fontSize: 10.5 }} />
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} sx={{ color: RH_COLOR }} />
        </Box>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            {/* Validações */}
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
                Checklist de Fechamento
              </Typography>
              <Card>
                <CardContent sx={{ p: '16px !important' }}>
                  <Stepper orientation="vertical" nonLinear>
                    {validations.map((v, i) => (
                      <Step key={i} active completed={v.ok}>
                        <StepLabel
                          icon={v.ok
                            ? <CheckIcon sx={{ color: '#34d399', fontSize: 20 }} />
                            : <BlockIcon sx={{ color: '#f87171', fontSize: 20 }} />
                          }
                          sx={{
                            '& .MuiStepLabel-label': { color: v.ok ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: v.ok ? 600 : 400 },
                          }}
                        >
                          {v.label}
                        </StepLabel>
                        <StepContent>
                          <Typography sx={{ fontSize: 11.5, color: v.ok ? '#34d399' : '#f87171', mb: 1 }}>
                            {v.detail}
                          </Typography>
                        </StepContent>
                      </Step>
                    ))}
                  </Stepper>
                </CardContent>
              </Card>

              {/* Resumo financeiro */}
              {items.length > 0 && (
                <Card sx={{ mt: 2 }}>
                  <CardContent sx={{ p: '14px !important' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
                      Resumo do Período
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Funcionários</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{items.length}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Total extras</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#34d399' }}>
                        {fmtBRL(items.reduce((s, i) => s + i.valor_extras, 0))}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Total descontos</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#f87171' }}>
                        {fmtBRL(items.reduce((s, i) => s + i.desconto_falta + i.desconto_atraso, 0))}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', pt: 1, mt: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'white' }}>Folha Total</Typography>
                      <Typography sx={{ fontSize: 15, fontWeight: 800, color: RH_COLOR }}>{fmtBRL(totalFolha)}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Box>

            {/* Ação */}
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
                Ação
              </Typography>

              {isFechada ? (
                <Card sx={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                  <CardContent sx={{ p: '20px !important', textAlign: 'center' }}>
                    <LockIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.25)', mb: 1.5 }} />
                    <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15, mb: 0.5 }}>
                      Competência Fechada
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', mb: 3 }}>
                      Esta competência foi fechada e não pode ser editada. Para reabrir, clique abaixo.
                    </Typography>
                    <Alert severity="warning" sx={{ mb: 2, textAlign: 'left', fontSize: 11.5 }}>
                      Reabrir permite recalcular, mas invalida qualquer exportação anterior.
                    </Alert>
                    <Button
                      startIcon={reopening ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <UnlockIcon />}
                      onClick={handleReabrir}
                      disabled={reopening}
                      variant="outlined"
                      fullWidth
                      sx={{ borderColor: '#f59e0b', color: '#f59e0b', '&:hover': { borderColor: '#f59e0b', bgcolor: 'rgba(245,158,11,0.08)' } }}
                    >
                      {reopening ? 'Reabrindo…' : 'Reabrir Competência'}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card sx={{
                  border: canClose ? `1px solid ${RH_COLOR}30` : '1px solid rgba(255,255,255,0.08)',
                  background: canClose ? `linear-gradient(135deg, ${RH_COLOR}08, transparent)` : 'transparent',
                }}>
                  <CardContent sx={{ p: '20px !important', textAlign: 'center' }}>
                    {canClose ? (
                      <>
                        <CheckIcon sx={{ fontSize: 40, color: '#34d399', mb: 1.5 }} />
                        <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15, mb: 0.5 }}>
                          Pronto para fechar
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', mb: 3 }}>
                          Todas as validações passaram. Ao fechar, a competência não poderá ser editada.
                        </Typography>
                      </>
                    ) : (
                      <>
                        <WarnIcon sx={{ fontSize: 40, color: '#f59e0b', mb: 1.5 }} />
                        <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15, mb: 0.5 }}>
                          Pendências encontradas
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', mb: 3 }}>
                          Resolva todos os itens do checklist antes de fechar.
                        </Typography>
                      </>
                    )}
                    <Button
                      startIcon={closing ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <LockIcon />}
                      onClick={handleFechar}
                      disabled={!canClose || closing}
                      fullWidth
                      sx={{
                        background: canClose ? `linear-gradient(135deg, ${RH_COLOR}, #db2777)` : 'rgba(255,255,255,0.06)',
                        color: 'white', fontWeight: 700, fontSize: 13,
                        boxShadow: canClose ? `0 4px 20px ${RH_COLOR}40` : 'none',
                        '&:disabled': { opacity: canClose ? 0.7 : 0.35, color: 'rgba(255,255,255,0.3)' },
                      }}
                    >
                      {closing ? 'Fechando…' : 'Fechar Competência'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </Box>
          </Box>
        </motion.div>
      )}
    </Box>
  );
};

export default RHFechamentosPage;
