import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  Lock as LockIcon,
  CheckCircleOutline as FeatureIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const logoUrl = new URL('../image/logo.png', import.meta.url).href;

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    transition: 'box-shadow 0.2s ease',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.14)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    '&.Mui-focused fieldset': { borderColor: 'rgba(96,165,250,0.7)' },
    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(37,99,235,0.2)' },
    '& input': { color: 'white' },
    '& input::placeholder': { color: 'rgba(255,255,255,0.35)', opacity: 1 },
    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
  '& .MuiFormHelperText-root': { color: '#f87171', ml: 0 },
};

const features = [
  'Registro de ponto por reconhecimento facial',
  'Espelho de ponto e banco de horas automático',
  'Feriados, turnos e configurações por empresa',
];

const LoginForm: React.FC = () => {
  const [formData, setFormData]       = useState({ usuario_id: '', senha: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [rememberLogin, setRememberLogin] = useState(false);

  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('rememberedLogin');
    if (saved) {
      try {
        const { usuario_id, senha } = JSON.parse(saved);
        setFormData({ usuario_id, senha });
        setRememberLogin(true);
      } catch {
        localStorage.removeItem('rememberedLogin');
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.usuario_id.trim()) newErrors.usuario_id = 'ID obrigatório';
    if (!formData.senha)            newErrors.senha       = 'Senha obrigatória';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    rememberLogin
      ? localStorage.setItem('rememberedLogin', JSON.stringify(formData))
      : localStorage.removeItem('rememberedLogin');
    const success = await login(formData);
    if (success) navigate('/dashboard');
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100vw',
      position: 'fixed',
      inset: 0,
      overflow: 'auto',
      background: `
        radial-gradient(ellipse 110% 50% at 65% -8%, rgba(96,165,250,0.25) 0%, transparent 65%),
        radial-gradient(ellipse 55% 40% at 5% 95%, rgba(99,102,241,0.14) 0%, transparent 55%),
        linear-gradient(155deg, #112466 0%, #1a3a8a 45%, #1e40af 100%)
      `,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: { xs: 2, md: 0 },
    }}>
      {/* Container split */}
      <Box sx={{
        width: '100%',
        maxWidth: { xs: 440, md: 960 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        minHeight: { md: 560 },
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>

        {/* ── Lado esquerdo: branding ── */}
        <Box sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          p: 5,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative spotlight */}
          <Box sx={{
            position: 'absolute',
            top: -80, left: -80,
            width: 300, height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Logo mark */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 5 }}>
              <Box sx={{
                width: 40, height: 40,
                background: 'white',
                borderRadius: '11px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                flexShrink: 0,
              }}>
                <img src={logoUrl} alt="RP" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 15, letterSpacing: '0.04em', lineHeight: 1.1 }}>
                  REGISTRA.PONTO
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: 11 }}>
                  Controle de Ponto
                </Typography>
              </Box>
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2, mb: 1.5 }}>
              Ponto eletrônico simples e confiável
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, mb: 4 }}>
              Gerencie registros, horários e banco de horas da sua equipe em um só lugar.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {features.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <FeatureIcon sx={{ fontSize: 16, color: '#34d399', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f}</Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>
          </motion.div>
        </Box>

        {/* ── Lado direito: formulário ── */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          p: { xs: 3, sm: 4, md: 5 },
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
        }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            {/* Logo no mobile */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 4 }}>
              <Box sx={{
                width: 36, height: 36,
                background: 'white',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                <img src={logoUrl} alt="RP" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
              <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 14, letterSpacing: '0.04em' }}>
                REGISTRA.PONTO
              </Typography>
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: 'white', letterSpacing: '-0.015em', mb: 0.75 }}>
              Bem-vindo de volta
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.42)', fontSize: 13.5, mb: 3.5 }}>
              Entre com suas credenciais de acesso
            </Typography>

            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  placeholder="ID do usuário"
                  name="usuario_id"
                  value={formData.usuario_id}
                  onChange={handleChange}
                  error={!!errors.usuario_id}
                  helperText={errors.usuario_id}
                  disabled={isLoading}
                  autoComplete="username"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={inputSx}
                />

                <TextField
                  fullWidth
                  placeholder="Senha"
                  name="senha"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.senha}
                  onChange={handleChange}
                  error={!!errors.senha}
                  helperText={errors.senha}
                  disabled={isLoading}
                  autoComplete="current-password"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={isLoading}
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
                        >
                          {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={inputSx}
                />
              </Box>

              <Box sx={{ mt: 1.5, mb: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberLogin}
                      onChange={e => setRememberLogin(e.target.checked)}
                      size="small"
                      sx={{
                        color: 'rgba(255,255,255,0.3)',
                        p: 0.75,
                        '&.Mui-checked': { color: '#60a5fa' },
                      }}
                    />
                  }
                  label="Lembrar login"
                  sx={{ '& .MuiTypography-root': { fontSize: 13, color: 'rgba(255,255,255,0.55)' } }}
                />
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{
                  py: 1.5,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.01em',
                  textTransform: 'none',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    boxShadow: '0 6px 24px rgba(37,99,235,0.5)',
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': {
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.3)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                {isLoading
                  ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />Entrando...</>
                  : 'Entrar'}
              </Button>
            </form>

            <Divider sx={{ mt: 3.5, borderColor: 'rgba(255,255,255,0.07)' }} />
            <Typography sx={{ mt: 2, textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.22)' }}>
              REGISTRA.PONTO © {new Date().getFullYear()}
            </Typography>
          </motion.div>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginForm;
