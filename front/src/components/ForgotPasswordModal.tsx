import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Help as HelpIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  open,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    usuario_id: '',
    email: '',
    nova_senha: '',
    confirmar_senha: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.usuario_id.trim()) {
      newErrors.usuario_id = 'ID do usuário é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
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
      // SIMULAÇÃO TEMPORÁRIA - Substitua por apiService.forgotPassword quando implementar o backend
      // await apiService.forgotPassword({
      //   usuario_id: formData.usuario_id,
      //   email: formData.email,
      //   nova_senha: formData.nova_senha,
      // });
      
      // Simulação de verificação (remover quando tiver backend real)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Validações básicas de exemplo (remover quando tiver backend real)
      if (formData.usuario_id.trim().length < 3) {
        throw new Error('ID de usuário muito curto');
      }
      
      if (!formData.email.includes('@')) {
        throw new Error('E-mail inválido');
      }
      
      toast.success('Senha alterada com sucesso! Você pode fazer login agora.');
      handleClose();
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      
      // Tratamento de erro melhorado
      let errorMessage = 'Erro ao alterar senha. Verifique seus dados.';
      
      if (error.response?.status === 404) {
        errorMessage = 'Usuário não encontrado ou e-mail não confere.';
      } else if (error.response?.status === 401) {
        errorMessage = 'E-mail não confere com o cadastrado.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      usuario_id: '',
      email: '',
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
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <HelpIcon sx={{ color: '#3b82f6' }} />
          <Typography variant="h6" fontWeight="600">
            Recuperar Senha
          </Typography>
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
            severity="info"
            sx={{
              mb: 3,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: 'white',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              '& .MuiAlert-icon': {
                color: '#3b82f6',
              },
            }}
          >
            Para redefinir sua senha, preencha os campos abaixo com seus dados de cadastro.
          </Alert>

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
              <strong>🚧 Versão de Demonstração:</strong> Este modal está simulando o funcionamento. 
              Para ativar completamente, implemente o endpoint `/forgot_password` no backend.
            </Typography>
          </Alert>

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
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
                      borderColor: '#3b82f6',
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#3b82f6',
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    color: '#ef4444',
                  },
                }}
              />

              <TextField
                fullWidth
                label="E-mail"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
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
                      borderColor: '#3b82f6',
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#3b82f6',
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    color: '#ef4444',
                  },
                }}
              />

              <TextField
                fullWidth
                label="Nova Senha"
                name="nova_senha"
                type={showPassword ? 'text' : 'password'}
                value={formData.nova_senha}
                onChange={handleChange}
                error={!!errors.nova_senha}
                helperText={errors.nova_senha}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        disabled={isLoading}
                        sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
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
                      borderColor: '#3b82f6',
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#3b82f6',
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    color: '#ef4444',
                  },
                }}
              />

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
                    <InputAdornment position="start">
                      <CheckIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        disabled={isLoading}
                        sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
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
                      borderColor: '#3b82f6',
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#3b82f6',
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
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {formData.nova_senha.length >= 6 && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 14 }} />}
                        label="6+ caracteres"
                        size="small"
                        sx={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '11px',
                        }}
                      />
                    )}
                    {/[A-Z]/.test(formData.nova_senha) && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 14 }} />}
                        label="Maiúscula"
                        size="small"
                        sx={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '11px',
                        }}
                      />
                    )}
                    {/[0-9]/.test(formData.nova_senha) && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 14 }} />}
                        label="Número"
                        size="small"
                        sx={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '11px',
                        }}
                      />
                    )}
                    {/[!@#$%^&*]/.test(formData.nova_senha) && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 14 }} />}
                        label="Especial"
                        size="small"
                        sx={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '11px',
                        }}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
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
            background: '#3b82f6',
            '&:hover': {
              background: '#2563eb',
            },
            '&:disabled': {
              background: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          {isLoading ? 'Alterando...' : 'Alterar Senha'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForgotPasswordModal;