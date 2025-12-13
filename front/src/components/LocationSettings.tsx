import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  TextField,
  Chip,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  MyLocation as MyLocationIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Radar as RadarIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';

interface LocationSettings {
  company_lat?: number;
  company_lng?: number;
  raio_permitido: number;
  exigir_localizacao: boolean;
}

const LocationSettings: React.FC = () => {
  const [settings, setSettings] = useState<LocationSettings>({
    raio_permitido: 100,
    exigir_localizacao: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'none' | 'success' | 'error'>('none');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/configuracoes');
      
      setSettings({
        company_lat: response.company_lat ? Number(response.company_lat) : undefined,
        company_lng: response.company_lng ? Number(response.company_lng) : undefined,
        raio_permitido: response.raio_permitido || 100,
        exigir_localizacao: response.exigir_localizacao || false,
      });

      if (response.company_lat && response.company_lng) {
        setLocationStatus('success');
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      toast.error('Erro ao carregar configurações de localização');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Seu navegador não suporta geolocalização');
      return;
    }

    setGettingLocation(true);
    setLocationStatus('none');

    // Função auxiliar para obter posição
    const getPosition = (highAccuracy: boolean, timeout: number, maxAge: number): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: timeout,
          maximumAge: maxAge
        });
      });
    };

    // Estratégia em 3 níveis (funciona em desktop e mobile)
    const tryGetLocation = async () => {
      try {
        let position: GeolocationPosition;
        
        try {
          // 1. Cache/IP (mais rápido, funciona em desktop)
          console.log('[LOCATION] Tentando localização rápida (cache/IP)...');
          position = await getPosition(false, 8000, 300000);
        } catch (e1) {
          try {
            // 2. Baixa precisão sem cache
            console.log('[LOCATION] Tentando baixa precisão...');
            position = await getPosition(false, 15000, 0);
          } catch (e2) {
            // 3. Alta precisão (GPS)
            console.log('[LOCATION] Tentando GPS (alta precisão)...');
            position = await getPosition(true, 30000, 0);
          }
        }

        const { latitude, longitude } = position.coords;
        
        setSettings(prev => ({
          ...prev,
          company_lat: latitude,
          company_lng: longitude,
        }));
        
        setLocationStatus('success');
        setGettingLocation(false);
        
        toast.success(`Localização capturada: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      } catch (error: any) {
        console.error('Erro ao obter localização:', error);
        setLocationStatus('error');
        setGettingLocation(false);
        
        let message = 'Erro ao obter localização';
        if (error.code === 1) {
          message = 'Permissão de localização negada. Por favor, permita o acesso à localização nas configurações do navegador.';
        } else if (error.code === 2) {
          message = 'Localização indisponível. Verifique suas configurações de rede.';
        } else if (error.code === 3) {
          message = 'Não foi possível obter localização. Tente novamente.';
        }
        
        toast.error(message);
      }
    };

    tryGetLocation();
  };

  const handleSave = async () => {
    if (!settings.company_lat || !settings.company_lng) {
      toast.error('Por favor, capture a localização antes de salvar');
      return;
    }

    try {
      setSaving(true);

      await apiService.post('/api/company/update-location', {
        company_lat: settings.company_lat,
        company_lng: settings.company_lng,
        raio_permitido: settings.raio_permitido,
        exigir_localizacao: settings.exigir_localizacao,
      });

      toast.success('Configurações de localização salvas com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
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
          <LocationIcon sx={{ color: '#3b82f6', fontSize: '24px' }} />
          <Box>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                color: 'white',
                fontSize: '18px'
              }}
            >
              Configurações de Localização
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '14px'
              }}
            >
              Configure a localização da empresa para validação de registros de ponto
            </Typography>
          </Box>
        </Box>

        {locationStatus === 'none' && !settings.company_lat && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Capture a localização atual da empresa para habilitar o registro de ponto por geolocalização.
          </Alert>
        )}

        {locationStatus === 'success' && settings.company_lat && settings.company_lng && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
            Localização salva: {Number(settings.company_lat).toFixed(6)}, {Number(settings.company_lng).toFixed(6)}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Capturar Localização */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box>
              <Typography 
                variant="subtitle2" 
                sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600, mb: 2 }}
              >
                Localização da Empresa
              </Typography>
              <Button
                variant="contained"
                fullWidth
                startIcon={gettingLocation ? <CircularProgress size={20} /> : <MyLocationIcon />}
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  },
                  py: 1.5,
                }}
              >
                {gettingLocation ? 'Obtendo localização...' : 'Capturar Minha Localização Atual'}
              </Button>
              <Typography 
                variant="caption" 
                sx={{ color: 'rgba(255, 255, 255, 0.6)', mt: 1, display: 'block' }}
              >
                Use este botão quando estiver fisicamente na empresa
              </Typography>
            </Box>
          </Grid>

          {/* Raio Permitido */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <RadarIcon sx={{ color: '#3b82f6', fontSize: '20px' }} />
                <Typography 
                  variant="subtitle2" 
                  sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}
                >
                  Raio Permitido
                </Typography>
              </Box>
              <Typography 
                variant="caption" 
                sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2, display: 'block' }}
              >
                Distância máxima aceitável para registro de ponto
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={settings.raio_permitido}
                  onChange={(e) => setSettings({ ...settings, raio_permitido: Number(e.target.value) })}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                  }}
                >
                  <MenuItem value={50}>50 metros</MenuItem>
                  <MenuItem value={100}>100 metros</MenuItem>
                  <MenuItem value={150}>150 metros</MenuItem>
                  <MenuItem value={200}>200 metros</MenuItem>
                  <MenuItem value={300}>300 metros</MenuItem>
                  <MenuItem value={500}>500 metros</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>

          {/* Exigir Validação */}
          <Grid size={{ xs: 12 }}>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.exigir_localizacao}
                    onChange={(e) => setSettings({ ...settings, exigir_localizacao: e.target.checked })}
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
                  <Box>
                    <Typography sx={{ color: 'white', fontWeight: 600 }}>
                      Exigir validação de localização
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                      Quando ativado, funcionários só poderão registrar ponto se estiverem dentro do raio definido
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Grid>

          {/* Preview da configuração */}
          {settings.company_lat && settings.company_lng && (
            <Grid size={{ xs: 12 }}>
              <Box 
                sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              >
                <Typography variant="subtitle2" sx={{ color: 'white', mb: 1, fontWeight: 600 }}>
                  Configuração Atual:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip 
                    label={`Lat: ${Number(settings.company_lat).toFixed(6)}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
                  />
                  <Chip 
                    label={`Lng: ${Number(settings.company_lng).toFixed(6)}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
                  />
                  <Chip 
                    label={`Raio: ${settings.raio_permitido}m`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
                  />
                  <Chip 
                    label={settings.exigir_localizacao ? 'Validação Ativa' : 'Validação Desativada'}
                    size="small"
                    color={settings.exigir_localizacao ? 'success' : 'default'}
                    sx={!settings.exigir_localizacao ? { bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'white' } : {}}
                  />
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !settings.company_lat}
            sx={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              },
            }}
          >
            {saving ? 'Salvando...' : 'Salvar Configurações de Localização'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LocationSettings;
