import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField,
  Switch, FormControlLabel, Select, MenuItem, InputLabel,
  FormControl, CircularProgress, Divider, Slider, InputAdornment,
} from '@mui/material';
import { Save as SaveIcon, Tune as TuneIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import RHTabNav from '../components/RHTabNav';
import { payrollService } from '../services/payrollService';
import type { PayrollConfig } from '../types';
import toast from 'react-hot-toast';

const RH_COLOR = '#f472b6';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
      {title}
    </Typography>
    <Card>
      <CardContent sx={{ p: '20px !important' }}>
        {children}
      </CardContent>
    </Card>
  </Box>
);

const defaultConfig: PayrollConfig = {
  company_id: '',
  horas_diarias: 8,
  horas_semanais: 44,
  percentual_hora_extra: 50,
  percentual_adicional_feriado: 100,
  percentual_adicional_domingo: 50,
  banco_horas_mode: 'compensar',
  arredondamento_minutos: 5,
  desconto_falta_proporcional: true,
  desconto_atraso: true,
  pagar_hora_extra: true,
  modo_calculo: 'mensal',
};

const RHSettingsPage: React.FC = () => {
  const [config, setConfig]   = useState<PayrollConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    payrollService.getConfig()
      .then(c => setConfig({ ...defaultConfig, ...c }))
      .catch(() => setConfig(defaultConfig))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof PayrollConfig>(key: K, value: PayrollConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await payrollService.saveConfig(config);
      toast.success('Configurações salvas');
    } catch {
      toast.error('Erro ao salvar configurações');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <Box>
      <RHTabNav />
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={32} sx={{ color: RH_COLOR }} />
      </Box>
    </Box>
  );

  return (
    <Box>
      <RHTabNav />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon sx={{ fontSize: 18, color: RH_COLOR }} />
          <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15 }}>
            Configurações de Folha
          </Typography>
        </Box>
        <Button
          startIcon={saving ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            background: `linear-gradient(135deg, ${RH_COLOR}, #db2777)`,
            color: 'white', fontWeight: 600, fontSize: 12.5,
            boxShadow: `0 4px 16px ${RH_COLOR}35`,
          }}
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </Box>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {/* Jornada */}
        <Section title="Jornada de Trabalho">
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Horas por dia"
              type="number"
              value={config.horas_diarias}
              onChange={e => set('horas_diarias', Number(e.target.value))}
              InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
              inputProps={{ min: 1, max: 12, step: 0.5 }}
              size="small"
            />
            <TextField
              label="Horas semanais"
              type="number"
              value={config.horas_semanais}
              onChange={e => set('horas_semanais', Number(e.target.value))}
              InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
              inputProps={{ min: 20, max: 48 }}
              size="small"
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Modo de cálculo</InputLabel>
              <Select
                value={config.modo_calculo}
                onChange={e => set('modo_calculo', e.target.value as PayrollConfig['modo_calculo'])}
                label="Modo de cálculo"
              >
                <MenuItem value="mensal">Mensal (dias úteis × horas/dia)</MenuItem>
                <MenuItem value="semanal">Semanal (semanas × horas/semana)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Section>

        {/* Banco de Horas */}
        <Section title="Banco de Horas">
          <FormControl size="small" fullWidth>
            <InputLabel>Modo do banco de horas</InputLabel>
            <Select
              value={config.banco_horas_mode}
              onChange={e => set('banco_horas_mode', e.target.value as PayrollConfig['banco_horas_mode'])}
              label="Modo do banco de horas"
            >
              <MenuItem value="compensar">Compensar (acumular para uso futuro)</MenuItem>
              <MenuItem value="pagar">Pagar (converter em dinheiro)</MenuItem>
              <MenuItem value="ignorar">Ignorar (não contabilizar)</MenuItem>
            </Select>
          </FormControl>
        </Section>

        {/* Adicionais e extras */}
        <Section title="Percentuais">
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 0.75 }}>
              Hora extra — {config.percentual_hora_extra}%
            </Typography>
            <Slider
              value={config.percentual_hora_extra}
              onChange={(_, v) => set('percentual_hora_extra', v as number)}
              min={25} max={200} step={25}
              marks={[25, 50, 75, 100, 150, 200].map(v => ({ value: v, label: `${v}%` }))}
              sx={{ color: RH_COLOR, '& .MuiSlider-markLabel': { fontSize: 10 } }}
            />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 0.75 }}>
              Adicional feriado — {config.percentual_adicional_feriado}%
            </Typography>
            <Slider
              value={config.percentual_adicional_feriado}
              onChange={(_, v) => set('percentual_adicional_feriado', v as number)}
              min={50} max={200} step={50}
              marks={[50, 100, 150, 200].map(v => ({ value: v, label: `${v}%` }))}
              sx={{ color: '#f59e0b', '& .MuiSlider-markLabel': { fontSize: 10 } }}
            />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 0.75 }}>
              Adicional domingo — {config.percentual_adicional_domingo}%
            </Typography>
            <Slider
              value={config.percentual_adicional_domingo}
              onChange={(_, v) => set('percentual_adicional_domingo', v as number)}
              min={25} max={150} step={25}
              marks={[25, 50, 75, 100, 150].map(v => ({ value: v, label: `${v}%` }))}
              sx={{ color: '#6366f1', '& .MuiSlider-markLabel': { fontSize: 10 } }}
            />
          </Box>
        </Section>

        {/* Arredondamento e descontos */}
        <Section title="Arredondamento e Descontos">
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <FormControl size="small">
              <InputLabel>Arredondamento de ponto</InputLabel>
              <Select
                value={config.arredondamento_minutos}
                onChange={e => set('arredondamento_minutos', Number(e.target.value))}
                label="Arredondamento de ponto"
              >
                {[1, 5, 10, 15].map(v => (
                  <MenuItem key={v} value={v}>{v} minutos</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.pagar_hora_extra}
                  onChange={e => set('pagar_hora_extra', e.target.checked)}
                  sx={{ '& .MuiSwitch-thumb': { bgcolor: RH_COLOR }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: RH_COLOR + '60' } }}
                />
              }
              label={<Typography sx={{ fontSize: 13 }}>Pagar horas extras</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.desconto_falta_proporcional}
                  onChange={e => set('desconto_falta_proporcional', e.target.checked)}
                  sx={{ '& .MuiSwitch-thumb': { bgcolor: RH_COLOR }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: RH_COLOR + '60' } }}
                />
              }
              label={<Typography sx={{ fontSize: 13 }}>Desconto proporcional por falta</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.desconto_atraso}
                  onChange={e => set('desconto_atraso', e.target.checked)}
                  sx={{ '& .MuiSwitch-thumb': { bgcolor: RH_COLOR }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: RH_COLOR + '60' } }}
                />
              }
              label={<Typography sx={{ fontSize: 13 }}>Desconto por atraso</Typography>}
            />
          </Box>
        </Section>
      </motion.div>
    </Box>
  );
};

export default RHSettingsPage;
