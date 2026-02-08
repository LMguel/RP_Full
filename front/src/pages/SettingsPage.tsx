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
  
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { CompanySettings } from '../types';
import LocationSettings from '../components/LocationSettings';
import HorarioEmpresaSettings from '../components/HorarioEmpresaSettings';

// Componente para configurações de ponto e horas extras
const TimeTrackingSettings: React.FC = () => {
  const { isFirstAccess, markConfigurationComplete } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>({
    empresa_id: '',
    tolerancia_atraso: 5,
    hora_extra_entrada_antecipada: false,
    arredondamento_horas_extras: '5',
    intervalo_automatico: false,
    duracao_intervalo: 60, // minutos
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      };
      
      // Mesclar resposta da API com valores padrão e garantir tipos corretos
      const mergedSettings = { 
        ...defaultSettings, 
        ...response,
        tolerancia_atraso: Number(response.tolerancia_atraso) || defaultSettings.tolerancia_atraso,
        hora_extra_entrada_antecipada: Boolean(response.hora_extra_entrada_antecipada),
        intervalo_automatico: Boolean(response.intervalo_automatico),
        duracao_intervalo: Number(response.duracao_intervalo) || defaultSettings.duracao_intervalo,
      };
      
      setSettings(mergedSettings);
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
      const dataToSend = {
        tolerancia_atraso: Number(settings.tolerancia_atraso) || 0,
        hora_extra_entrada_antecipada: Boolean(settings.hora_extra_entrada_antecipada),
        arredondamento_horas_extras: settings.arredondamento_horas_extras,
        intervalo_automatico: Boolean(settings.intervalo_automatico),
        duracao_intervalo: Number(settings.duracao_intervalo) || 60,
      };

      // Validations...
      
      await apiService.put('/api/configuracoes', dataToSend);
      
      // Marcar configuração como completa se for primeiro acesso
      if (isFirstAccess) {
        markConfigurationComplete();
        toast.success('Configuração inicial concluída! Sistema pronto para uso.');
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
                Conforme CLT Art. 58, §1º e Súmula 366 do TST, a tolerância máxima permitida é de <b>10 minutos por dia</b> (somatório de atrasos e antecipações).<br />
                Não é permitido configurar valores acima de 10 minutos ou tolerância separada para entrada/saída.
              </Typography>
              <FormControl fullWidth sx={{ mt: 1 }}>
                <InputLabel id="tolerancia-label" sx={{ color: 'rgba(255,255,255,0.7)' }}>Tolerância</InputLabel>
                <Select
                  labelId="tolerancia-label"
                  value={settings.tolerancia_atraso}
                  label="Tolerância"
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSettings({ ...settings, tolerancia_atraso: value });
                  }}
                  sx={{
                    color: 'rgba(255,255,255,0.9)',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.2)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.3)',
                    },
                  }}
                >
                  <MenuItem value={0}>0 minutos</MenuItem>
                  <MenuItem value={5}>5 minutos</MenuItem>
                  <MenuItem value={10}>10 minutos (máximo legal)</MenuItem>
                </Select>
              </FormControl>
              {settings.tolerancia_atraso > 10 && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Valor acima do permitido pela legislação. Ajuste para até 10 minutos.
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
  const { user, logout, isFirstAccess } = useAuth();
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
        {/* Time Tracking Settings - TOP */}
        <Grid size={{ xs: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <TimeTrackingSettings />
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

        {/* Location Settings */}
        <Grid size={{ xs: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <LocationSettings />
          </motion.div>
        </Grid>
      </Grid>
    </PageLayout>
  );
};

export default SettingsPage;
