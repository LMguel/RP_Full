import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Drawer, Divider, FormControl, InputLabel,
  Select, MenuItem, Alert, IconButton, Tooltip, LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Calculate as CalcIcon,
  ChevronRight as ChevronIcon,
  Person as PersonIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import RHTabNav from '../components/RHTabNav';
import {
  payrollService, fmtBRL, fmtHoras, fmtCompetencia,
  competenciaAtual, statusColor,
} from '../services/payrollService';
import type { PreFolhaItem, Competencia } from '../types';
import toast from 'react-hot-toast';

const RH_COLOR = '#f472b6';

const FormulaLine: React.FC<{ label: string; value: string; color?: string; negative?: boolean }> = ({
  label, value, color = 'rgba(255,255,255,0.65)', negative,
}) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>{label}</Typography>
    <Typography sx={{ fontSize: 12, fontWeight: 600, color: negative ? '#f87171' : color }}>{value}</Typography>
  </Box>
);

const RHPreFolhaPage: React.FC = () => {
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [selectedComp, setSelectedComp] = useState('');
  const [items, setItems]               = useState<PreFolhaItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [calculating, setCalculating]   = useState(false);
  const [drawer, setDrawer]             = useState<PreFolhaItem | null>(null);
  const location = useLocation();

  const loadCompetencias = useCallback((forceComp?: string) => {
    const params = new URLSearchParams(location.search);
    const comp   = forceComp ?? params.get('comp') ?? competenciaAtual();
    payrollService.listCompetencias().then(r => {
      setCompetencias(r.competencias);
      const found = r.competencias.find(c => c.competencia === comp);
      // Se não encontrou na lista, usa a competência atual mesmo assim
      // (o Select tem um MenuItem fallback para esse caso)
      setSelectedComp(found ? comp : r.competencias[0]?.competencia ?? competenciaAtual());
    }).catch(() => {
      setSelectedComp(competenciaAtual());
    });
  }, [location.search]);

  useEffect(() => { loadCompetencias(); }, [loadCompetencias]);

  const loadPreFolha = useCallback((comp: string) => {
    if (!comp) return;
    setLoading(true);
    payrollService.getPreFolha(comp)
      .then(r => setItems(r.pre_folha))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedComp) loadPreFolha(selectedComp);
  }, [selectedComp, loadPreFolha]);

  const handleCalcular = async () => {
    if (!selectedComp) return;
    const comp = competencias.find(c => c.competencia === selectedComp);
    if (comp?.status === 'FECHADA') { toast.error('Competência fechada'); return; }
    setCalculating(true);
    try {
      const r = await payrollService.calcular(selectedComp);
      setItems(r.pre_folha);
      // Recarrega lista de competências (pode ter sido auto-criada no backend)
      loadCompetencias(selectedComp);
      toast.success(`Pré-folha calculada — ${r.total_funcionarios} funcionários · Total: ${fmtBRL(r.total_folha)}`);
    } catch {
      toast.error('Erro ao calcular pré-folha');
    } finally { setCalculating(false); }
  };

  const compAtual   = competencias.find(c => c.competencia === selectedComp);
  const sc          = statusColor(compAtual?.status ?? '');
  const totalFolha  = items.reduce((s, i) => s + i.total, 0);
  const totalExtras = items.reduce((s, i) => s + i.valor_extras, 0);
  const totalFaltas = items.reduce((s, i) => s + i.desconto_falta, 0);

  return (
    <Box>
      <RHTabNav />

      {/* Controles */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
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
                  sx={{
                    ml: 1, height: 16, fontSize: 9.5,
                    bgcolor: statusColor(c.status) + '18',
                    color: statusColor(c.status),
                  }}
                />
              </MenuItem>
            ))}
            {/* Fallback: se competência atual não está na lista ainda */}
            {selectedComp && !competencias.find(c => c.competencia === selectedComp) && (
              <MenuItem value={selectedComp}>
                {fmtCompetencia(selectedComp)}
                <Chip label="NOVA" size="small" sx={{ ml: 1, height: 16, fontSize: 9.5, bgcolor: '#10b98118', color: '#10b981' }} />
              </MenuItem>
            )}
          </Select>
        </FormControl>

        <Button
          startIcon={calculating ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <CalcIcon />}
          onClick={handleCalcular}
          disabled={calculating || compAtual?.status === 'FECHADA'}
          sx={{
            background: `linear-gradient(135deg, ${RH_COLOR}, #db2777)`,
            color: 'white', fontWeight: 600, fontSize: 12.5,
            boxShadow: `0 4px 16px ${RH_COLOR}35`,
            '&:disabled': { opacity: 0.5 },
          }}
        >
          {calculating ? 'Calculando…' : 'Calcular Pré-Folha'}
        </Button>

        <Tooltip title="Recarregar">
          <IconButton onClick={() => loadPreFolha(selectedComp)} size="small"
            sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px' }}>
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        {compAtual && (
          <Chip
            label={compAtual.status}
            size="small"
            sx={{ bgcolor: sc + '18', color: sc, border: `1px solid ${sc}35`, fontWeight: 700, fontSize: 10.5, ml: 'auto' }}
          />
        )}
      </Box>

      {/* Totalizadores */}
      {items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2 }}>
            {[
              { label: 'Folha Total',   value: fmtBRL(totalFolha),  color: RH_COLOR },
              { label: 'Total Extras',  value: fmtBRL(totalExtras), color: '#34d399' },
              { label: 'Total Faltas',  value: fmtBRL(totalFaltas), color: '#f87171' },
            ].map(t => (
              <Box key={t.label} sx={{
                p: '10px 14px', borderRadius: '10px',
                background: t.color + '0d', border: `1px solid ${t.color}22`, textAlign: 'center',
              }}>
                <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.3 }}>
                  {t.label}
                </Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'white' }}>{t.value}</Typography>
              </Box>
            ))}
          </Box>
        </motion.div>
      )}

      {calculating && (
        <LinearProgress sx={{
          mb: 1.5, borderRadius: 99,
          bgcolor: 'rgba(255,255,255,0.06)',
          '& .MuiLinearProgress-bar': { bgcolor: RH_COLOR },
        }} />
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} sx={{ color: RH_COLOR }} />
        </Box>
      ) : items.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CalcIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.15)', mb: 1.5 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, mb: 1.5 }}>
              Nenhum dado calculado para esta competência
            </Typography>
            <Button
              onClick={handleCalcular}
              sx={{ background: `linear-gradient(135deg, ${RH_COLOR}, #db2777)`, color: 'white', fontWeight: 600 }}
            >
              Calcular Agora
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
                    {['Funcionário', 'Tipo', 'Horas Prev.', 'Horas Trab.', 'Banco', 'Extras', 'Faltas', 'Valor Base', 'Total', ''].map(h => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map(item => {
                    const deltaH = item.horas_trabalhadas - item.horas_previstas;
                    return (
                      <TableRow
                        key={item.employee_id}
                        hover
                        onClick={() => setDrawer(item)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
                            <Box sx={{
                              width: 26, height: 26, borderRadius: '7px',
                              background: `linear-gradient(135deg, ${RH_COLOR}30, ${RH_COLOR}10)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              <PersonIcon sx={{ fontSize: 14, color: RH_COLOR }} />
                            </Box>
                            <Typography sx={{ fontWeight: 600, color: 'white', fontSize: 12.5 }}>
                              {item.nome}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.tipo_remuneracao === 'mensalista' ? 'Mensalista' : 'Horista'}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 10.5, height: 20 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                            {fmtHoras(item.horas_previstas)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, color: 'white', fontSize: 12 }}>
                            {fmtHoras(item.horas_trabalhadas)}
                          </Typography>
                          {deltaH !== 0 && (
                            <Typography sx={{ fontSize: 10.5, color: deltaH > 0 ? '#34d399' : '#f87171' }}>
                              {deltaH > 0 ? '+' : ''}{fmtHoras(deltaH)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: item.banco_horas >= 0 ? '#34d399' : '#f87171' }}>
                            {item.banco_horas >= 0 ? '+' : ''}{fmtHoras(item.banco_horas)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: item.horas_extras > 0 ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                            +{fmtHoras(item.horas_extras)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: item.horas_falta > 0 ? '#f87171' : 'rgba(255,255,255,0.3)' }}>
                            {item.horas_falta > 0 ? `-${fmtHoras(item.horas_falta)}` : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                            {fmtBRL(item.salario_base)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 13 }}>
                            {fmtBRL(item.total)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <ChevronIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.25)' }} />
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

      {/* Drawer de detalhes */}
      <AnimatePresence>
        {drawer && (
          <Drawer
            anchor="right"
            open={!!drawer}
            onClose={() => setDrawer(null)}
            PaperProps={{
              sx: {
                width: { xs: '100%', sm: 420 },
                background: 'rgba(10,22,66,0.98)',
                backdropFilter: 'blur(32px)',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                p: 0,
              },
            }}
          >
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <Box>
                <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 16 }}>{drawer.nome}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  {drawer.tipo_remuneracao === 'mensalista' ? 'Mensalista' : 'Horista'} · {fmtCompetencia(drawer.competencia)}
                </Typography>
              </Box>
              <IconButton onClick={() => setDrawer(null)} size="small">
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            <Box sx={{ p: 2.5, overflow: 'auto', flex: 1 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
                Horas
              </Typography>
              <Card sx={{ mb: 2 }}>
                <CardContent sx={{ p: '12px !important' }}>
                  <FormulaLine label="Horas previstas"   value={fmtHoras(drawer.horas_previstas)} />
                  <FormulaLine label="Horas trabalhadas" value={fmtHoras(drawer.horas_trabalhadas)} />
                  <FormulaLine label="Horas extras"      value={`+${fmtHoras(drawer.horas_extras)}`} color="#34d399" />
                  <FormulaLine label="Faltas"            value={fmtHoras(drawer.horas_falta)} negative={drawer.horas_falta > 0} />
                  <FormulaLine
                    label="Banco de horas"
                    value={`${drawer.banco_horas >= 0 ? '+' : ''}${fmtHoras(drawer.banco_horas)}`}
                    color={drawer.banco_horas >= 0 ? '#34d399' : '#f87171'}
                  />
                  <FormulaLine label="Dias úteis"       value={`${drawer.dias_uteis} dias`} />
                  <FormulaLine label="Dias trabalhados" value={`${drawer.dias_trabalhados} dias`} />
                  {drawer.atraso_minutos > 0 && (
                    <FormulaLine label="Atraso total" value={`${Math.round(drawer.atraso_minutos)} min`} negative />
                  )}
                </CardContent>
              </Card>

              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
                Composição Financeira
              </Typography>
              <Card sx={{ mb: 2 }}>
                <CardContent sx={{ p: '12px !important' }}>
                  <FormulaLine label="Salário base" value={fmtBRL(drawer.salario_base)} color="white" />
                  <FormulaLine label="Valor hora"   value={`${fmtBRL(drawer.valor_hora)}/h`} />
                  {drawer.valor_extras > 0 && (
                    <FormulaLine label="+ Horas extras"          value={fmtBRL(drawer.valor_extras)} color="#34d399" />
                  )}
                  {drawer.valor_feriado > 0 && (
                    <FormulaLine label="+ Adicional feriado"     value={fmtBRL(drawer.valor_feriado)} color="#34d399" />
                  )}
                  {drawer.valor_domingo > 0 && (
                    <FormulaLine label="+ Adicional domingo"     value={fmtBRL(drawer.valor_domingo)} color="#34d399" />
                  )}
                  {drawer.valor_banco > 0 && (
                    <FormulaLine label="+ Banco de horas (pago)" value={fmtBRL(drawer.valor_banco)} color="#34d399" />
                  )}
                  {drawer.desconto_falta > 0 && (
                    <FormulaLine label="− Desconto falta"  value={fmtBRL(drawer.desconto_falta)} negative />
                  )}
                  {drawer.desconto_atraso > 0 && (
                    <FormulaLine label="− Desconto atraso" value={fmtBRL(drawer.desconto_atraso)} negative />
                  )}
                  {drawer.desconto_banco > 0 && (
                    <FormulaLine label="− Banco negativo"  value={fmtBRL(drawer.desconto_banco)} negative />
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 14 }}>Total Estimado</Typography>
                    <Typography sx={{ fontWeight: 800, color: RH_COLOR, fontSize: 18 }}>
                      {fmtBRL(drawer.total)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Alert severity="info" sx={{ fontSize: 11.5 }}>
                Valor estimado de pré-folha. Não inclui INSS, FGTS, IRRF, férias ou outros encargos legais.
              </Alert>
            </Box>
          </Drawer>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default RHPreFolhaPage;
