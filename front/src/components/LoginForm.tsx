import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  CircularProgress,
  Container,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  Person as PersonIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const logoUrl = new URL('../image/logo.png', import.meta.url).href;

const LoginForm: React.FC = () => {
  const [formData, setFormData] = useState({
    usuario_id: '',
    senha: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberLogin, setRememberLogin] = useState(false);
  
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  // Carregar dados salvos do localStorage ao iniciar
  useEffect(() => {
    const savedLogin = localStorage.getItem('rememberedLogin');
    if (savedLogin) {
      try {
        const { usuario_id, senha } = JSON.parse(savedLogin);
        setFormData({ usuario_id, senha });
        setRememberLogin(true);
      } catch (e) {
        localStorage.removeItem('rememberedLogin');
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.usuario_id.trim()) {
      newErrors.usuario_id = 'ID do usuário é obrigatório';
    }

    if (!formData.senha) {
      newErrors.senha = 'Senha é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Salvar ou remover login do localStorage
    if (rememberLogin) {
      localStorage.setItem('rememberedLogin', JSON.stringify(formData));
    } else {
      localStorage.removeItem('rememberedLogin');
    }

    const success = await login(formData);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'auto',

      }}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, py: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Card
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxWidth: 400,
              mx: 'auto',
            }}
          >
            <CardContent sx={{ p: { xs: 4, sm: 5 }, textAlign: 'center' }}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                style={{ marginBottom: 48 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                  }}
                >
                  <Box
                    sx={{
                      width: 150, // Aumentado de 120 para 150
                      height: 150, // Aumentado de 120 para 150
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    <img 
                      src={logoUrl} 
                      alt="RP Logo"
                      style={{
                        width: '200%', // Aumentado de 80% para 90%
                        height: '200%', // Aumentado de 80% para 90%
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                </Box>

                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 400, 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    mb: 1,
                    letterSpacing: '0.5px',
                    fontSize: '18px'
                  }}
                >
                  Sistema de Controle de Ponto Eletrônico
                </Typography>
              </motion.div>

              <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                  <Box>
                    <TextField
                      fullWidth
                      placeholder="ID do Usuário"
                      name="usuario_id"
                      value={formData.usuario_id}
                      onChange={handleChange}
                      error={!!errors.usuario_id}
                      helperText={errors.usuario_id}
                      variant="outlined"
                      disabled={isLoading}
                      size="medium"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        sx: {
                          color: 'white',
                          fontSize: '16px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '1px',
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.7)',
                          },
                          '& input': {
                            padding: '14px 12px 14px 0',
                            color: 'white',
                          },
                          '& input::placeholder': {
                            color: 'rgba(255, 255, 255, 0.6)',
                            opacity: 1,
                          },
                          background: 'rgba(255, 255, 255, 0.05)',
                        }
                      }}
                      FormHelperTextProps={{
                        sx: { color: '#ef4444' }
                      }}
                    />
                  </Box>

                  <Box>
                    <TextField
                      fullWidth
                      placeholder="Senha"
                      name="senha"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.senha}
                      onChange={handleChange}
                      error={!!errors.senha}
                      helperText={errors.senha}
                      variant="outlined"
                      disabled={isLoading}
                      size="medium"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                              disabled={isLoading}
                              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                              sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                '&:hover': {
                                  color: 'rgba(255, 255, 255, 0.9)',
                                }
                              }}
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                        sx: {
                          color: 'white',
                          fontSize: '16px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '1px',
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.7)',
                          },
                          '& input': {
                            padding: '14px 12px 14px 0',
                            color: 'white',
                          },
                          '& input::placeholder': {
                            color: 'rgba(255, 255, 255, 0.6)',
                            opacity: 1,
                          },
                          background: 'rgba(255, 255, 255, 0.05)',
                        }
                      }}
                      FormHelperTextProps={{
                        sx: { color: '#ef4444' }
                      }}
                    />
                  </Box>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rememberLogin}
                        onChange={(e) => setRememberLogin(e.target.checked)}
                        sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          '&.Mui-checked': {
                            color: '#60a5fa',
                          },
                        }}
                      />
                    }
                    label="Lembrar login"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      '& .MuiTypography-root': {
                        fontSize: '14px',
                      },
                    }}
                  />
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                  sx={{ 
                    mt: 4,
                    py: 2, 
                    borderRadius: '8px', 
                    background: '#2563eb',
                    fontSize: '16px',
                    fontWeight: 600,
                    textTransform: 'none',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: '#1d4ed8',
                    },
                    '&:disabled': {
                      background: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </Container>
    </Box>
  );
};

export default LoginForm;