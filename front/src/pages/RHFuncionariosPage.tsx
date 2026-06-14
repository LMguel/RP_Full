import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Drawer, Divider, TextField, InputAdornment,
  ToggleButton, ToggleButtonGroup, FormControl, InputLabel,
  Select, MenuItem, Switch, IconButton, Button,
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import RHTabNav from '../components/RHTabNav';
import { payrollService, fmtBRL, competenciaAtual } from '../services/payrollService';
import type { Employee, EmployeePayrollConfig, BancoHorasMode, TipoRemuneracao } from '../types';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

const RH_COLOR = '#f472b6';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    background: 'rgba(255,255,255,0.04)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: RH_COLOR + '80' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', '&.Mui-focused': { color: RH_COLOR } },
  '& .MuiInputBase-input': { color: 'white' },
  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.35)' },
};

function isActive(emp: Employee): boolean {
  return emp.is_active !== false && emp.ativo !== false;
}

interface DisplayEmployee {
  emp: Employee;
  inativoComRegistro: boolean;
}

const RHFuncionariosPage: React.FC = () => {
  const [displayList, setDisplayList] = useState<DisplayEmployee[]>([]);
  const [configs, setConfigs]         = useState<Record<string, EmployeePayrollConfig>>({});
  const [loading, setLoading]         = useState(true);
  const [drawer, setDrawer]           = useState<Employee | null>(null);
  const [saving, setSaving]           = useState(false);

  // Drawer form state
  const [tipo, setTipo]           = useState<TipoRemuneracao>('mensalista');
  const [salario, setSalario]     = useState('');
  const [valorHora, setValorHora] = useState('');
  const [bancoMode, setBancoMode] = useState<BancoHorasMode>('compensar');
  const [extra, setExtra]         = useState(true);
  const [feriado, setFeriado]     = useState(true);
  const [domingo, setDomingo]     = useState(false);
  const [obs, setObs]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const comp = competenciaAtual();

      const [empRes, cfgRes, prefolhaRes] = await Promise.allSettled([
        apiService.getEmployees(),
        payrollService.listEmpConfigs(),
        payrollService.getPreFolha(comp),
      ]);

      // ── Funcionários ──────────────────────────────────────────────
      let empList: Employee[] = [];
      if (empRes.status === 'fulfilled') {
        const val = empRes.value;
        if (Array.isArray(val)) empList = val;
        else if (val?.funcionarios) empList = val.funcionarios;
        else if (val?.data?.funcionarios) empList = val.data.funcionarios;
        else if (Array.isArray(val?.data)) empList = val.data;
      }

      // ── IDs com registro no mês (via pré-folha calculada) ─────────
      const idsComRegistroNoMes = new Set<string>();
      if (prefolhaRes.status === 'fulfilled') {
        for (const item of prefolhaRes.value.pre_folha) {
          if (item.employee_id) idsComRegistroNoMes.add(item.employee_id);
        }
      }

      // ── Regra de exibição ─────────────────────────────────────────
      // Ativo → sempre exibe
      // Inativo → exibe apenas se tem registro no mês atual
      const list: DisplayEmployee[] = [];
      for (const emp of empList) {
        const ativo = isActive(emp);
        if (ativo) {
          list.push({ emp, inativoComRegistro: false });
        } else if (idsComRegistroNoMes.has(emp.id ?? '')) {
          list.push({ emp, inativoComRegistro: true });
        }
      }

      // Ordena: ativos primeiro, depois inativos com registro, ambos alfabéticos
      list.sort((a, b) => {
        if (a.inativoComRegistro !== b.inativoComRegistro)
          return a.inativoComRegistro ? 1 : -1;
        return a.emp.nome.localeCompare(b.emp.nome, 'pt-BR');
      });

      setDisplayList(list);

      // ── Configs salariais ─────────────────────────────────────────
      if (cfgRes.status === 'fulfilled') {
        const map: Record<string, EmployeePayrollConfig> = {};
        for (const c of cfgRes.value.configs) map[c.employee_id] = c;
        setConfigs(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const empId = (e: Employee) => e.id ?? '';

  const openDrawer = (emp: Employee) => {
    const cfg = configs[empId(emp)];
    setTipo(cfg?.tipo_remuneracao ?? 'mensalista');
    setSalario(cfg?.salario_base ? String(cfg.salario_base) : '');
    setValorHora(cfg?.valor_hora ? String(cfg.valor_hora) : '');
    setBancoMode(cfg?.banco_horas_mode ?? 'compensar');
    setExtra(cfg?.recebe_hora_extra ?? true);
    setFeriado(cfg?.recebe_adicional_feriado ?? true);
    setDomingo(cfg?.recebe_adicional_domingo ?? false);
    setObs(cfg?.observacoes_rh ?? '');
    setDrawer(emp);
  };

  const handleSave = async () => {
    if (!drawer) return;
    const id = empId(drawer);
    if (!id) { toast.error('ID do funcionário inválido'); return; }
    setSaving(true);
    try {
      await payrollService.saveEmpConfig(id, {
        tipo_remuneracao: tipo,
        salario_base: salario ? parseFloat(salario) : 0,
        valor_hora: valorHora ? parseFloat(valorHora) : 0,
        banco_horas_mode: bancoMode,
        recebe_hora_extra: extra,
        recebe_adicional_feriado: feriado,
        recebe_adicional_domingo: domingo,
        observacoes_rh: obs,
      });
      toast.success(`Remuneração de ${drawer.nome} salva`);
      setConfigs(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          employee_id: id,
          company_id: '',
          tipo_remuneracao: tipo,
          salario_base: parseFloat(salario) || 0,
          valor_hora: parseFloat(valorHora) || 0,
          banco_horas_mode: bancoMode,
          recebe_hora_extra: extra,
          recebe_adicional_feriado: feriado,
          recebe_adicional_domingo: domingo,
          observacoes_rh: obs,
        },
      }));
      setDrawer(null);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const ativos    = displayList.filter(d => !d.inativoComRegistro).length;
  const inativos  = displayList.filter(d => d.inativoComRegistro).length;
  const semConfig = displayList.filter(d => !configs[empId(d.emp)]?.salario_base).length;

  return (
    <Box>
      <RHTabNav />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15 }}>
          Remuneração dos Funcionários
        </Typography>
        {!loading && (
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <Chip
              label={`${ativos} ativo${ativos !== 1 ? 's' : ''}`}
              size="small"
              sx={{ bgcolor: '#10b98118', color: '#10b981', border: '1px solid #10b98130', fontSize: 10.5, height: 20 }}
            />
            {inativos > 0 && (
              <Chip
                label={`${inativos} inativo${inativos !== 1 ? 's' : ''} c/ registro`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', fontSize: 10.5, height: 20 }}
              />
            )}
            {semConfig > 0 && (
              <Chip
                label={`${semConfig} sem salário`}
                size="small"
                sx={{ bgcolor: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b30', fontSize: 10.5, height: 20 }}
              />
            )}
          </Box>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={32} sx={{ color: RH_COLOR }} />
        </Box>
      ) : displayList.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <PersonIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.15)', mb: 1.5 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Nenhum funcionário ativo no período
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }}>
          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Funcionário', 'Cargo', 'Tipo', 'Salário Base', 'Valor Hora', 'Banco de Horas', ''].map(h => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayList.map(({ emp, inativoComRegistro }) => {
                    const id        = empId(emp);
                    const cfg       = configs[id];
                    const configured = !!cfg?.salario_base;

                    return (
                      <TableRow
                        key={id}
                        hover
                        onClick={() => openDrawer(emp)}
                        sx={{
                          cursor: 'pointer',
                          opacity: inativoComRegistro ? 0.65 : 1,
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
                            <Box sx={{
                              width: 26, height: 26, borderRadius: '7px',
                              background: configured
                                ? `linear-gradient(135deg, ${RH_COLOR}30, ${RH_COLOR}10)`
                                : 'rgba(255,255,255,0.06)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              <PersonIcon sx={{ fontSize: 14, color: configured ? RH_COLOR : 'rgba(255,255,255,0.3)' }} />
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 600, color: 'white', fontSize: 12.5, lineHeight: 1.2 }}>
                                {emp.nome}
                              </Typography>
                              {inativoComRegistro && (
                                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>
                                  inativo · com registro no mês
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>

                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {emp.cargo || '—'}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {cfg?.tipo_remuneracao ? (
                            <Chip
                              label={cfg.tipo_remuneracao === 'mensalista' ? 'Mensalista' : 'Horista'}
                              size="small"
                              sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 10.5, height: 20 }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: 11, color: '#f59e0b', fontStyle: 'italic' }}>
                              não configurado
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell>
                          <Typography sx={{
                            fontWeight: configured ? 700 : 400,
                            color: configured ? 'white' : '#f59e0b',
                            fontSize: 12.5,
                          }}>
                            {configured ? fmtBRL(cfg.salario_base) : '—'}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {cfg?.valor_hora ? fmtBRL(cfg.valor_hora) + '/h' : '—'}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {cfg?.banco_horas_mode ? (
                            <Chip
                              label={{ compensar: 'Compensar', pagar: 'Pagar', ignorar: 'Ignorar' }[cfg.banco_horas_mode] ?? cfg.banco_horas_mode}
                              size="small"
                              sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: 10, height: 18 }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</Typography>
                          )}
                        </TableCell>

                        <TableCell sx={{ pr: 1.5 }}>
                          <IconButton size="small" sx={{ color: configured ? RH_COLOR : '#f59e0b', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                            <EditIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          {inativos > 0 && (
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', mt: 1.25, pl: 0.5 }}>
              Funcionários inativos aparecem apenas quando têm registros de ponto no mês atual.
            </Typography>
          )}
        </motion.div>
      )}

      {/* Drawer de configuração salarial */}
      <Drawer
        anchor="right"
        open={!!drawer}
        onClose={() => setDrawer(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 440 },
            background: 'rgba(10,22,66,0.98)',
            backdropFilter: 'blur(32px)',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', flexDirection: 'column',
          },
        }}
      >
        {drawer && (
          <>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 16 }}>{drawer.nome}</Typography>
                  {!isActive(drawer) && (
                    <Chip label="Inativo" size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }} />
                  )}
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>{drawer.cargo}</Typography>
              </Box>
              <IconButton onClick={() => setDrawer(null)} size="small">
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            <Box sx={{ p: 2.5, overflow: 'auto', flex: 1 }}>

              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
                Tipo de Remuneração
              </Typography>
              <ToggleButtonGroup
                value={tipo} exclusive
                onChange={(_, v) => v && setTipo(v)}
                fullWidth sx={{ mb: 2.5, '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.12)', py: 1.25, fontSize: 13, fontWeight: 500, '&.Mui-selected': { background: `linear-gradient(135deg, ${RH_COLOR}22, ${RH_COLOR}08)`, color: RH_COLOR, borderColor: RH_COLOR + '40' } } }}
              >
                <ToggleButton value="mensalista">Mensalista</ToggleButton>
                <ToggleButton value="horista">Horista</ToggleButton>
              </ToggleButtonGroup>

              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
                Valores
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
                <TextField
                  label="Salário base (R$)"
                  value={salario}
                  onChange={e => setSalario(e.target.value)}
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  fullWidth size="small"
                  helperText={
                    tipo === 'mensalista' && salario
                      ? `≈ ${fmtBRL(parseFloat(salario) / 176)}/h calculado automaticamente`
                      : 'Valor bruto mensal'
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><MoneyIcon sx={{ fontSize: 16, color: RH_COLOR, opacity: 0.7 }} /></InputAdornment>,
                  }}
                  sx={fieldSx}
                />
                <TextField
                  label={tipo === 'mensalista' ? 'Valor hora manual (opcional)' : 'Valor hora (R$/h)'}
                  value={valorHora}
                  onChange={e => setValorHora(e.target.value)}
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  fullWidth size="small"
                  helperText={
                    tipo === 'mensalista'
                      ? 'Deixe vazio para calcular automaticamente (salário ÷ 176h)'
                      : 'Valor pago por hora efetivamente trabalhada'
                  }
                  sx={fieldSx}
                />
              </Box>

              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
                Banco de Horas
              </Typography>
              <FormControl size="small" fullWidth sx={{ mb: 2.5 }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.45)', '&.Mui-focused': { color: RH_COLOR } }}>Modo</InputLabel>
                <Select
                  value={bancoMode}
                  onChange={e => setBancoMode(e.target.value as BancoHorasMode)}
                  label="Modo"
                  sx={{ color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' } }}
                  MenuProps={{ PaperProps: { sx: { background: 'rgba(10,22,66,0.97)', '& .MuiMenuItem-root': { color: 'white', fontSize: 13, '&:hover': { background: 'rgba(244,114,182,0.1)' }, '&.Mui-selected': { background: 'rgba(244,114,182,0.18)' } } } } }}
                >
                  <MenuItem value="compensar">Compensar — acumula para folga futura</MenuItem>
                  <MenuItem value="pagar">Pagar — horas extras viram dinheiro</MenuItem>
                  <MenuItem value="ignorar">Ignorar — não contabiliza</MenuItem>
                </Select>
              </FormControl>

              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                Adicionais
              </Typography>
              <Card sx={{ mb: 2.5 }}>
                <Box sx={{ px: 2, py: 0.5 }}>
                  {([
                    { label: 'Hora extra',         sub: 'Adicional sobre horas além da jornada', val: extra,   set: setExtra   },
                    { label: 'Adicional feriado',  sub: 'Percentual extra em feriados trabalhados', val: feriado, set: setFeriado },
                    { label: 'Adicional domingo',  sub: 'Percentual extra nos domingos trabalhados', val: domingo, set: setDomingo },
                  ] as const).map(({ label, sub, val, set }, i, arr) => (
                    <Box key={label}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25 }}>
                        <Box>
                          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{label}</Typography>
                          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{sub}</Typography>
                        </Box>
                        <Switch
                          checked={val}
                          onChange={e => set(e.target.checked)}
                          size="small"
                          sx={{
                            '& .MuiSwitch-thumb': { bgcolor: val ? RH_COLOR : 'rgba(255,255,255,0.25)' },
                            '& .Mui-checked + .MuiSwitch-track': { bgcolor: RH_COLOR + '55 !important' },
                          }}
                        />
                      </Box>
                      {i < arr.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
                    </Box>
                  ))}
                </Box>
              </Card>

              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
                Observações
              </Typography>
              <TextField
                label="Observações RH"
                value={obs}
                onChange={e => setObs(e.target.value)}
                multiline rows={3} fullWidth
                placeholder="Acordos especiais, observações do contrato..."
                sx={fieldSx}
              />
            </Box>

            <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 1 }}>
              <IconButton onClick={() => setDrawer(null)} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', px: 2, color: 'rgba(255,255,255,0.55)' }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Button
                onClick={handleSave}
                disabled={!salario || saving}
                fullWidth
                startIcon={saving ? <CircularProgress size={15} sx={{ color: 'white' }} /> : <SaveIcon />}
                sx={{
                  background: `linear-gradient(135deg, ${RH_COLOR}, #db2777)`,
                  color: 'white', fontWeight: 700, borderRadius: '10px',
                  boxShadow: `0 4px 16px ${RH_COLOR}35`,
                  '&:disabled': { opacity: 0.45, color: 'rgba(255,255,255,0.4)' },
                }}
              >
                {saving ? 'Salvando…' : 'Salvar Remuneração'}
              </Button>
            </Box>
          </>
        )}
      </Drawer>
    </Box>
  );
};

export default RHFuncionariosPage;
