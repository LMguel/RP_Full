import React, { useState, useEffect } from 'react';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  Avatar,
  IconButton,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as BusinessIcon,
  Security as SecurityIcon,
  PhotoCamera as PhotoCameraIcon,
  Save as SaveIcon,
  Timer as TimerIcon,
  AccessTime as AccessTimeIcon,
  LocationOn as LocationOnIcon,
  MyLocation as MyLocationIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { CompanySettings } from '../types';
import HorarioEmpresaSettings from '../components/HorarioEmpresaSettings';
import HolidayCalendarSettings from '../components/HolidayCalendarSettings';
import UsersSettings from '../components/UsersSettings';

// Componente para dados da empresa (nome e CNPJ para relatórios)
const CompanyInfoSettings: React.FC = () => {
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaCnpj, setEmpresaCnpj] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.get('/api/empresa/dados').then((r: any) => {
      setEmpresaNome(r?.empresa_nome_display || '');
      setEmpresaCnpj(r?.empresa_cnpj || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.put('/api/empresa/dados', {
        empresa_nome_display: empresaNome.trim(),
        empresa_cnpj: empresaCnpj.replace(/\D/g, ''),
      });
      toast.success('Dados da empresa salvos!');
    } catch {
      toast.error('Erro ao salvar dados da empresa');
    } finally {
      setSaving(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: 'rgba(255,255,255,0.9)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
  };

  return (
    <Card sx={{ background:'rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', borderRadius:'16px', border:'1px solid rgba(255,255,255,0.1)' }}>
      <CardContent>
        <Box sx={{ display:'flex', alignItems:'center', gap:2, mb:3 }}>
          <BusinessIcon sx={{ color:'#3b82f6', fontSize:'24px' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight:600, color:'white', fontSize:'18px' }}>
              Dados da Empresa
            </Typography>
            <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.6)', fontSize:'14px' }}>
              Informações exibidas nos relatórios e espelhos de ponto exportados
            </Typography>
          </Box>
        </Box>
        {loading ? (
          <Box sx={{ display:'flex', justifyContent:'center', p:3 }}><CircularProgress sx={{ color:'#3b82f6' }} /></Box>
        ) : (
          <Grid container spacing={3}>
            <Grid size={{ xs:12, md:6 }}>
              <TextField
                fullWidth
                label="Nome da Empresa (para relatórios)"
                placeholder="Ex: Empresa XYZ Ltda"
                value={empresaNome}
                onChange={e => setEmpresaNome(e.target.value)}
                sx={inputSx}
              />
            </Grid>
            <Grid size={{ xs:12, md:6 }}>
              <TextField
                fullWidth
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                value={formatCnpj(empresaCnpj)}
                onChange={e => setEmpresaCnpj(e.target.value)}
                inputProps={{ maxLength: 18 }}
                sx={inputSx}
              />
            </Grid>
            <Grid size={{ xs:12 }}>
              <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                  sx={{ background:'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', '&:hover':{ background:'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' } }}
                >
                  {saving ? 'Salvando...' : 'Salvar Dados'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

// Localização da empresa — define o ponto central e o raio permitido pra
// validação de geolocalização do registro de ponto (app do funcionário e
// tablet). Campos gravados via /api/company/update-location (company_lat/
// company_lng/raio_permitido/exigir_localizacao) — são os mesmos nomes que
// o backend lê na hora de validar o registro; não usar latitude_empresa/
// longitude_empresa (nomes legados de outro endpoint) pra não descasar.
const LocationSettings: React.FC = () => {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [raio, setRaio] = useState('100');
  const [exigirLocalizacao, setExigirLocalizacao] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    apiService.get('/api/configuracoes').then((r: any) => {
      const latVal = r?.company_lat ?? r?.latitude;
      const lngVal = r?.company_lng ?? r?.longitude;
      if (latVal != null) setLat(String(latVal));
      if (lngVal != null) setLng(String(lngVal));
      if (r?.raio_permitido != null) setRaio(String(r.raio_permitido));
      setExigirLocalizacao(Boolean(r?.exigir_localizacao));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Seu navegador não suporta geolocalização.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
        toast.success('Localização atual capturada — confira no mapa e salve.');
      },
      () => {
        setLocating(false);
        toast.error('Não foi possível obter sua localização. Permita o acesso e tente de novo.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    const latNum = parseFloat(lat.replace(',', '.'));
    const lngNum = parseFloat(lng.replace(',', '.'));
    const raioNum = parseInt(raio, 10);

    if (exigirLocalizacao && (isNaN(latNum) || isNaN(lngNum))) {
      toast.error('Informe latitude e longitude, ou use "Usar minha localização atual".');
      return;
    }
    if (!isNaN(latNum) && (latNum < -90 || latNum > 90)) {
      toast.error('Latitude deve estar entre -90 e 90.');
      return;
    }
    if (!isNaN(lngNum) && (lngNum < -180 || lngNum > 180)) {
      toast.error('Longitude deve estar entre -180 e 180.');
      return;
    }
    if (isNaN(raioNum) || raioNum < 10 || raioNum > 5000) {
      toast.error('Raio deve estar entre 10m e 5000m.');
      return;
    }

    setSaving(true);
    try {
      await apiService.post('/api/company/update-location', {
        company_lat: latNum,
        company_lng: lngNum,
        raio_permitido: raioNum,
        exigir_localizacao: exigirLocalizacao,
      });
      toast.success('Localização da empresa salva!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar localização');
    } finally {
      setSaving(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: 'rgba(255,255,255,0.9)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
    '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.5)' },
  };

  const temCoordenadas = lat.trim() !== '' && lng.trim() !== '' && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));

  return (
    <Card sx={{ background:'rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', borderRadius:'16px', border:'1px solid rgba(255,255,255,0.1)' }}>
      <CardContent>
        <Box sx={{ display:'flex', alignItems:'center', gap:2, mb:3 }}>
          <LocationOnIcon sx={{ color:'#3b82f6', fontSize:'24px' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight:600, color:'white', fontSize:'18px' }}>
              Localização da Empresa
            </Typography>
            <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.6)', fontSize:'14px' }}>
              Define o ponto e o raio dentro dos quais o registro de ponto é considerado "no local"
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display:'flex', justifyContent:'center', p:3 }}><CircularProgress sx={{ color:'#3b82f6' }} /></Box>
        ) : (
          <>
            <Alert
              severity="info"
              sx={{ mb: 3, backgroundColor: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.2)', color: 'white', '& .MuiAlert-icon': { color: '#2196f3' } }}
            >
              Fora do raio o ponto ainda é registrado — a Portaria 671/2021 não permite bloquear o registro.
              Isso só marca o ponto como "fora do raio" pra você revisar em Registros.
            </Alert>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Button
                  variant="outlined"
                  startIcon={locating ? <CircularProgress size={18} /> : <MyLocationIcon />}
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.85)', '&:hover': { borderColor: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)' } }}
                >
                  {locating ? 'Obtendo localização...' : 'Usar minha localização atual'}
                </Button>
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255,255,255,0.5)' }}>
                  Abra esta página no celular, estando fisicamente na empresa, pra capturar a coordenada certa.
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label="Latitude" placeholder="Ex: -22.9707" value={lat} onChange={e => setLat(e.target.value)} sx={inputSx} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label="Longitude" placeholder="Ex: -44.3086" value={lng} onChange={e => setLng(e.target.value)} sx={inputSx} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Raio permitido"
                  value={raio}
                  onChange={e => setRaio(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment>, inputProps: { min: 10, max: 5000 } }}
                  helperText="Entre 10m e 5000m"
                  sx={inputSx}
                />
              </Grid>

              {temCoordenadas && (
                <Grid size={{ xs: 12 }}>
                  <Button
                    size="small"
                    startIcon={<OpenInNewIcon fontSize="small" />}
                    component="a"
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: '#60a5fa', textTransform: 'none' }}
                  >
                    Conferir esse ponto no Google Maps
                  </Button>
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', my: 1 }} />
                <FormControlLabel
                  control={
                    <Switch
                      checked={exigirLocalizacao}
                      onChange={(e) => setExigirLocalizacao(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' },
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                        Exigir localização no registro
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        Desligado: o GPS do registro não é comparado com este ponto — nenhum registro é marcado como "fora do raio".
                      </Typography>
                    </Box>
                  }
                />
              </Grid>
            </Grid>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                sx={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' } }}
              >
                {saving ? 'Salvando...' : 'Salvar Localização'}
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Componente para configurações de ponto e horas extras
const TimeTrackingSettings: React.FC = () => {
  const { isFirstAccess, markConfigurationComplete } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>({
    empresa_id: '',
    tolerancia_atraso: 5,
    hora_extra_entrada_antecipada: false,
    arredondamento_horas_extras: '5',
    intervalo_automatico: false,
    duracao_intervalo: 60,
    intervalo_padrao_global: null,
  });
  const [funcionariosAtualizados, setFuncionariosAtualizados] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toleranciaInput, setToleranciaInput] = useState('5');

  useEffect(() => {
    loadSettings();
  }, []);

    const loadSettings = async () => {
      try {
        setLoading(true);
      const response = await apiService.get('/api/configuracoes');      // Garantir que todos os campos tenham valores padrão
      const defaultSettings: CompanySettings = {
        empresa_id: '',
        tolerancia_atraso: 5,
        hora_extra_entrada_antecipada: false,
        arredondamento_horas_extras: '5',
        intervalo_automatico: false,
        duracao_intervalo: 60,
        intervalo_padrao_global: null,
      };

      // Mesclar resposta da API com valores padrão e garantir tipos corretos
      // Usa != null (não ||) para não substituir um valor salvo como 0 pelo padrão
      const mergedSettings = {
        ...defaultSettings,
        ...response,
        tolerancia_atraso: response.tolerancia_atraso != null ? Number(response.tolerancia_atraso) : defaultSettings.tolerancia_atraso,
        hora_extra_entrada_antecipada: Boolean(response.hora_extra_entrada_antecipada),
        intervalo_automatico: Boolean(response.intervalo_automatico),
        duracao_intervalo: response.duracao_intervalo != null ? Number(response.duracao_intervalo) : defaultSettings.duracao_intervalo,
        intervalo_padrao_global: response.intervalo_padrao_global != null ? Number(response.intervalo_padrao_global) : null,
      };
      
      setSettings(mergedSettings);
      setToleranciaInput(String(mergedSettings.tolerancia_atraso));
    } catch (err: any) {
      console.error('Error loading settings:', err);
      toast.error('Erro ao carregar configurações de ponto');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Garantir que todos os valores sejam do tipo correto
      // Usa toleranciaInput diretamente para não depender do blur do campo ter disparado antes do clique em Salvar
      const toleranciaFinal = Math.max(0, parseInt(toleranciaInput, 10) || 0);
      const dataToSend = {
        tolerancia_atraso: toleranciaFinal,
        hora_extra_entrada_antecipada: Boolean(settings.hora_extra_entrada_antecipada),
        arredondamento_horas_extras: settings.arredondamento_horas_extras,
        intervalo_automatico: Boolean(settings.intervalo_automatico),
        duracao_intervalo: Number(settings.duracao_intervalo) || 60,
        intervalo_padrao_global: settings.intervalo_padrao_global != null ? Number(settings.intervalo_padrao_global) : null,
      };

      const result = await apiService.put('/api/configuracoes', dataToSend);

      setSettings((prev) => ({ ...prev, tolerancia_atraso: toleranciaFinal }));
      setToleranciaInput(String(toleranciaFinal));

      const atualizados = result?.funcionarios_atualizados ?? 0;
      setFuncionariosAtualizados(atualizados > 0 ? atualizados : null);

      // Marcar configuração como completa se for primeiro acesso
      if (isFirstAccess) {
        markConfigurationComplete();
        toast.success('Configuração inicial concluída! Sistema pronto para uso.');
      } else if (atualizados > 0) {
        toast.success(`Configurações salvas! Intervalo aplicado a ${atualizados} funcionário${atualizados !== 1 ? 's' : ''}.`);
      } else {
        toast.success('Configurações salvas com sucesso!');
      }
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card 
        sx={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      sx={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <TimerIcon sx={{ color: '#3b82f6', fontSize: '24px' }} />
          <Box>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                color: 'white',
                fontSize: '18px'
              }}
            >
              Configurações de Ponto e Horas Extras
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '14px'
              }}
            >
              Personalize as regras de registro de ponto da empresa
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={4} justifyContent="space-between">
          {/* Tolerância de Atraso */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AccessTimeIcon sx={{ color: '#3b82f6', fontSize: '20px' }} />
                <Typography 
                  variant="subtitle2" 
                  sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}
                >
                  Tolerância de Ponto (Legal)
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, display: 'block' }}
              >
                Conforme CLT Art. 58, §1º e Súmula 366 do TST, a tolerância legal padrão é de <b>10 minutos por dia</b> (somatório de atrasos e antecipações).
                Ajuste livremente conforme a necessidade da empresa.
              </Typography>
              <TextField
                fullWidth
                type="number"
                label="Tolerância (minutos)"
                value={toleranciaInput}
                onChange={(e) => {
                  // Mantém o texto livre enquanto digita (evita resetar para 0
                  // ao limpar o campo antes de digitar o novo valor).
                  setToleranciaInput(e.target.value);
                }}
                onBlur={() => {
                  const value = Math.max(0, parseInt(toleranciaInput, 10) || 0);
                  setToleranciaInput(String(value));
                  setSettings((prev) => ({ ...prev, tolerancia_atraso: value }));
                }}
                inputProps={{ min: 0 }}
                sx={{
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    color: 'rgba(255,255,255,0.9)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                }}
              />
              {settings.tolerancia_atraso > 10 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Valor acima do limite legal padrão de 10 minutos. Confirme se essa configuração é intencional para a empresa.
                </Alert>
              )}
            </Box>
          </Grid>

          {/* Hora Extra por Entrada Antecipada */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TimerIcon sx={{ color: '#3b82f6', fontSize: '20px' }} />
                <Typography 
                  variant="subtitle2" 
                  sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}
                >
                  Entrada Antecipada
                </Typography>
              </Box>
              <Typography 
                variant="caption" 
                sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2, display: 'block' }}
              >
                Conta como hora extra se chegar antes
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.hora_extra_entrada_antecipada}
                    onChange={(e) => setSettings({ ...settings, hora_extra_entrada_antecipada: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#3b82f6',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#3b82f6',
                      },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    {settings.hora_extra_entrada_antecipada ? 'Ativado' : 'Desativado'}
                  </Typography>
                }
              />
            </Box>
          </Grid>

          {/* Arredondamento: opção removida para evitar alteração pelo usuário */}

          {/* Intervalo Automático */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TimerIcon sx={{ color: '#3b82f6', fontSize: '20px' }} />
                <Typography 
                  variant="subtitle2" 
                  sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}
                >
                  Intervalo Automático
                </Typography>
              </Box>
              <Typography 
                variant="caption" 
                sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2, display: 'block' }}
              >
                Descontar automaticamente hora do almoço
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.intervalo_automatico}
                      onChange={(e) => setSettings({ ...settings, intervalo_automatico: e.target.checked })}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#3b82f6',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#3b82f6',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {settings.intervalo_automatico ? 'Ativado' : 'Desativado'}
                    </Typography>
                  }
                />
                {settings.intervalo_automatico && (
                  <TextField
                    type="number"
                    label="Duração do Intervalo"
                    value={settings.duracao_intervalo === 0 ? '' : settings.duracao_intervalo}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value === '' ? 0 : parseInt(value) || 0;
                      setSettings({ ...settings, duracao_intervalo: Math.max(0, numValue) });
                    }}
                    onBlur={(e) => {
                      // Quando sair do campo, se estiver vazio, define como 0
                      if (e.target.value === '') {
                        setSettings({ ...settings, duracao_intervalo: 0 });
                      }
                    }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">min</InputAdornment>,
                      inputProps: { min: 0, max: 480 },
                    }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: 'rgba(255, 255, 255, 0.9)',
                        '& fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#3b82f6',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: 'rgba(255, 255, 255, 0.7)',
                      },
                    }}
                  />
                )}
              </Box>
            </Box>
          </Grid>

          {/* Intervalo Padrão Global */}
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', my: 1 }} />
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AccessTimeIcon sx={{ color: '#3b82f6', fontSize: '20px' }} />
                <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                  Tempo de intervalo da empresa
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2, display: 'block' }}>
                Ao salvar, aplica este valor como <b>intervalo padrão</b> para funcionários que ainda não têm intervalo definido (exceto horista).
                Deixe em branco para não alterar nenhum funcionário.
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  type="number"
                  label="Intervalo padrão (minutos)"
                  value={settings.intervalo_padrao_global ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFuncionariosAtualizados(null);
                    setSettings({ ...settings, intervalo_padrao_global: val === '' ? null : Math.max(0, parseInt(val) || 0) });
                  }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">min</InputAdornment>,
                    inputProps: { min: 0, max: 480 },
                  }}
                  helperText="Ex: 0 (sem intervalo) · 60 (1h) · 90 (1h30)"
                  sx={{
                    width: 240,
                    '& .MuiOutlinedInput-root': {
                      color: 'rgba(255, 255, 255, 0.9)',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.5)' },
                  }}
                />
                {funcionariosAtualizados != null && (
                  <Typography variant="caption" sx={{ color: '#4ade80' }}>
                    {funcionariosAtualizados} funcionário{funcionariosAtualizados !== 1 ? 's' : ''} atualizado{funcionariosAtualizados !== 1 ? 's' : ''} no último save
                  </Typography>
                )}
              </Box>
            </Box>
          </Grid>

        </Grid>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              },
            }}
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

const SettingsPage: React.FC = () => {
  const { user, logout, isFirstAccess, hasPermission } = useAuth();
  const canManageUsers = hasPermission('criar_usuario') || hasPermission('editar_usuario');
  const [loading, setLoading] = useState(false);
  
  // Security Settings
  const [securityData, setSecurityData] = useState({
    senha_atual: '',
    nova_senha: '',
    confirmar_senha: '',
  });

  const handleSecurityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSecurityData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChangePassword = async () => {
    if (securityData.nova_senha !== securityData.confirmar_senha) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (securityData.nova_senha.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      // API call to change password
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Senha alterada com sucesso!');
      setSecurityData({
        senha_atual: '',
        nova_senha: '',
        confirmar_senha: '',
      });
    } catch (error) {
      toast.error('Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <PageLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 4 }}>
          {isFirstAccess && (
            <Alert 
              severity="info" 
              sx={{ 
                mb: 3,
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                border: '1px solid rgba(33, 150, 243, 0.2)',
                color: 'white',
                '& .MuiAlert-icon': {
                  color: '#2196f3'
                }
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                🎉 Primeira configuração do sistema! Configure os parâmetros básicos para começar a utilizar.
              </Typography>
            </Alert>
          )}
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 600, 
              color: 'white', 
              mb: 1,
              fontSize: '28px'
            }}
          >
            Configurações
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '16px'
            }}
          >
            Gerencie suas configurações pessoais e da empresa
          </Typography>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Dados da Empresa - primeiro */}
        <Grid size={{ xs: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            <CompanyInfoSettings />
          </motion.div>
        </Grid>

        {/* Localização da Empresa */}
        <Grid size={{ xs: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            <LocationSettings />
          </motion.div>
        </Grid>

        {/* Time Tracking Settings */}
        <Grid size={{ xs: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <TimeTrackingSettings />
          </motion.div>
        </Grid>

        {/* Calendário de Feriados */}
        <Grid size={{ xs: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
          >
            <HolidayCalendarSettings />
          </motion.div>
        </Grid>

        {/* Horários da Empresa */}
        <Grid size={{ xs: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <HorarioEmpresaSettings />
          </motion.div>
        </Grid>

        {/* Usuários da Empresa */}
        {canManageUsers && (
          <Grid size={{ xs: 12 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <UsersSettings />
            </motion.div>
          </Grid>
        )}

      </Grid>
    </PageLayout>
  );
};

export default SettingsPage;
