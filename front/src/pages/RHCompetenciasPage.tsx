import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  LockOpen as OpenIcon,
  Lock as LockedIcon,
  Autorenew as ProcessingIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import RHTabNav from '../components/RHTabNav';
import { payrollService, fmtBRL, fmtCompetencia, statusColor, competenciaAtual } from '../services/payrollService';
import type { Competencia } from '../types';
import toast from 'react-hot-toast';

const RH_COLOR = '#f472b6';

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  switch (status?.toUpperCase()) {
    case 'ABERTA':      return <OpenIcon       sx={{ fontSize: 14 }} />;
    case 'FECHADA':     return <LockedIcon      sx={{ fontSize: 14 }} />;
    case 'PROCESSANDO': return <ProcessingIcon  sx={{ fontSize: 14 }} />;
    default:            return null;
  }
};

const RHCompetenciasPage: React.FC = () => {
  const [list, setList]         = useState<Competencia[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [modal, setModal]       = useState(false);
  const [newComp, setNewComp]   = useState(competenciaAtual());
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    payrollService.listCompetencias()
      .then(r => setList(r.competencias))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newComp.match(/^\d{4}-\d{2}$/)) {
      toast.error('Formato inválido. Use AAAA-MM'); return;
    }
    setCreating(true);
    try {
      await payrollService.createCompetencia(newComp);
      toast.success('Competência criada');
      setModal(false);
      load();
    } catch {
      toast.error('Erro ao criar competência');
    } finally { setCreating(false); }
  };

  return (
    <Box>
      <RHTabNav />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15 }}>
          Competências
        </Typography>
        <Button
          startIcon={<AddIcon />}
          onClick={() => setModal(true)}
          sx={{
            background: `linear-gradient(135deg, ${RH_COLOR}, #db2777)`,
            color: 'white', fontWeight: 600, fontSize: 12.5,
            boxShadow: `0 4px 16px ${RH_COLOR}40`,
            '&:hover': { opacity: 0.88 },
          }}
        >
          Nova Competência
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2, borderRadius: '10px', fontSize: 12 }}>
        Uma competência é o período mensal de referência para o cálculo da pré-folha. Cada mês é criado separadamente e pode ser recalculado enquanto estiver ABERTA.
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} sx={{ color: RH_COLOR }} />
        </Box>
      ) : list.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CalendarIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.15)', mb: 1.5 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Nenhuma competência criada
            </Typography>
            <Button
              onClick={() => setModal(true)}
              sx={{ mt: 2, color: RH_COLOR, borderColor: RH_COLOR + '40', border: '1px solid' }}
            >
              Criar primeira competência
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Competência', 'Status', 'Total Folha', 'Total Extras', 'Total Faltas', 'Calculado em', 'Ações'].map(h => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map(c => {
                    const sc = statusColor(c.status);
                    return (
                      <TableRow key={c.competencia} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarIcon sx={{ fontSize: 14, color: RH_COLOR, opacity: 0.7 }} />
                            <Typography sx={{ fontWeight: 600, color: 'white', fontSize: 13 }}>
                              {fmtCompetencia(c.competencia)}
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                              {c.competencia}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<StatusIcon status={c.status} />}
                            label={c.status}
                            size="small"
                            sx={{
                              bgcolor: sc + '18', color: sc,
                              border: `1px solid ${sc}35`,
                              fontWeight: 700, fontSize: 10.5, height: 22,
                              '& .MuiChip-icon': { color: sc, fontSize: 13 },
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 13 }}>
                            {fmtBRL(c.total_folha)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: '#34d399', fontSize: 12 }}>
                            {fmtBRL(c.total_extras)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: '#f87171', fontSize: 12 }}>
                            {fmtBRL(c.total_faltas)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5 }}>
                            {c.calculado_em ? new Date(c.calculado_em).toLocaleDateString('pt-BR') : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.75 }}>
                            <Button
                              size="small"
                              onClick={() => navigate(`/rh/pre-folha?comp=${c.competencia}`)}
                              sx={{ fontSize: 11, color: RH_COLOR, border: `1px solid ${RH_COLOR}30`, minWidth: 'auto', px: 1.25 }}
                            >
                              Ver Folha
                            </Button>
                            {c.status !== 'FECHADA' && (
                              <Button
                                size="small"
                                onClick={() => navigate(`/rh/fechamentos?comp=${c.competencia}`)}
                                sx={{ fontSize: 11, color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', minWidth: 'auto', px: 1.25 }}
                              >
                                Fechar
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </motion.div>
      )}

      {/* Modal nova competência */}
      <Dialog open={modal} onClose={() => setModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Nova Competência</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, mb: 2 }}>
            Informe o mês de referência no formato AAAA-MM.
          </Typography>
          <TextField
            label="Competência (AAAA-MM)"
            value={newComp}
            onChange={e => setNewComp(e.target.value)}
            fullWidth
            placeholder="2026-06"
            inputProps={{ maxLength: 7 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setModal(false)} variant="outlined">Cancelar</Button>
          <Button
            onClick={handleCreate}
            disabled={creating}
            sx={{
              background: `linear-gradient(135deg, ${RH_COLOR}, #db2777)`,
              color: 'white', fontWeight: 600,
            }}
          >
            {creating ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RHCompetenciasPage;
