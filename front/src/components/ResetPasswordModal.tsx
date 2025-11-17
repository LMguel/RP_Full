import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Stack,
} from '@mui/material';
import {
  Lock as LockIcon,
  Person as PersonIcon,
  Visibility,
  VisibilityOff,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  open,
  onClose,
  userId: initialUserId = '',
}) => {
  const [formData, setFormData] = useState({
    usuario_id: initialUserId,
    nova_senha: '',
    confirmar_senha: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialUserId) {
      setFormData(prev => ({ ...prev, usuario_id: initialUserId }));
    }
  }, [initialUserId]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.usuario_id.trim()) {
      newErrors.usuario_id = 'ID do usuário é obrigatório';
    }

    if (!formData.nova_senha) {
      newErrors.nova_senha = 'Nova senha é obrigatória';
    } else if (formData.nova_senha.length < 6) {
      newErrors.nova_senha = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (!formData.confirmar_senha) {
      newErrors.confirmar_senha = 'Confirmação de senha é obrigatória';
    } else if (formData.nova_senha !== formData.confirmar_senha) {
      newErrors.confirmar_senha = 'Senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Chamada real para a API
      await apiService.resetPassword(formData.usuario_id, formData.nova_senha);
      
      toast.success(`Senha redefinida para o usuário: ${formData.usuario_id}`);
      handleClose();
    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao redefinir senha. Tente novamente.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      usuario_id: '',
      nova_senha: '',
      confirmar_senha: '',
    });
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({
      ...prev,
      nova_senha: password,
      confirmar_senha: password,
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white',
        }
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
          fontWeight: 600,
        }}
      >
        <Box display="flex" alignItems="center" gap={1} component="span">
          <LockIcon sx={{ color: '#ef4444' }} />
          <Box component="span">
            Redefinir Senha de Usuário
          </Box>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert
            severity="warning"
            sx={{
              mb: 3,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              color: 'white',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              '& .MuiAlert-icon': {
                color: '#f59e0b',
              },
            }}
          >
            <Typography variant="body2">
              <strong>⚠️ Atenção:</strong> Esta ação irá redefinir a senha do usuário. 
              Certifique-se de fornecer a nova senha de forma segura ao funcionário.
            </Typography>
          </Alert>

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="ID do Usuário"
                name="usuario_id"
                value={formData.usuario_id}
                onChange={handleChange}
                error={!!errors.usuario_id}
                helperText={errors.usuario_id}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <PersonIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', mr: 1 }} />
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#ef4444',
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#ef4444',
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    color: '#ef4444',
                  },
                }}
              />

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" color="rgba(255, 255, 255, 0.8)">
                    Nova Senha
                  </Typography>
                  <Button
                    size="small"
                    onClick={generateRandomPassword}
                    disabled={isLoading}
                    sx={{
                      color: '#3b82f6',
                      textTransform: 'none',
                      fontSize: '12px',
                      '&:hover': {
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      },
                    }}
                  >
                    Gerar Senha Aleatória
                  </Button>
                </Box>
                <TextField
                  fullWidth
                  name="nova_senha"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.nova_senha}
                  onChange={handleChange}
                  error={!!errors.nova_senha}
                  helperText={errors.nova_senha}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <LockIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', mr: 1 }} />
                    ),
                    endAdornment: (
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        disabled={isLoading}
                        sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#ef4444',
                      },
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '& .MuiFormHelperText-root': {
                      color: '#ef4444',
                    },
                  }}
                />
              </Box>

              <TextField
                fullWidth
                label="Confirmar Nova Senha"
                name="confirmar_senha"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmar_senha}
                onChange={handleChange}
                error={!!errors.confirmar_senha}
                helperText={errors.confirmar_senha}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <CheckIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', mr: 1 }} />
                  ),
                  endAdornment: (
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      disabled={isLoading}
                      sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#ef4444',
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#ef4444',
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    color: '#ef4444',
                  },
                }}
              />

              {formData.nova_senha && (
                <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <Typography variant="body2" color="rgba(255, 255, 255, 0.8)" gutterBottom>
                    Força da Senha:
                  </Typography>
                  <Box display="flex" gap={1} mb={1}>
                    {formData.nova_senha.length >= 6 && (
                      <Chip
                        icon={<CheckIcon />}
                        label="6+ caracteres"
                        size="small"
                        sx={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '10px',
                        }}
                      />
                    )}
                    {/[A-Z]/.test(formData.nova_senha) && (
                      <Chip
                        icon={<CheckIcon />}
                        label="Maiúscula"
                        size="small"
                        sx={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '10px',
                        }}
                      />
                    )}
                    {/[0-9]/.test(formData.nova_senha) && (
                      <Chip
                        icon={<CheckIcon />}
                        label="Número"
                        size="small"
                        sx={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '10px',
                        }}
                      />
                    )}
                    {/[!@#$%^&*]/.test(formData.nova_senha) && (
                      <Chip
                        icon={<CheckIcon />}
                        label="Especial"
                        size="small"
                        sx={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '10px',
                        }}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </Stack>
          </form>
        </motion.div>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          disabled={isLoading}
          sx={{
            color: 'white',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || Object.keys(errors).length > 0}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <LockIcon />}
          sx={{
            background: '#ef4444',
            '&:hover': {
              background: '#dc2626',
            },
            '&:disabled': {
              background: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResetPasswordModal;