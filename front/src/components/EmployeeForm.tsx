import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  Avatar,
  Autocomplete,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { Employee, HorarioPreset } from '../types';
import { config } from '../config';

interface EmployeeFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  employee?: Employee | null;
  loading?: boolean;
  existingCargos?: string[];
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  open,
  onClose,
  onSubmit,
  employee,
  loading = false,
  existingCargos = [],
}) => {
  const [formData, setFormData] = useState({
    nome: employee?.nome || '',
    cargo: employee?.cargo || '',
    senha: '',
    confirmarSenha: '',
    horario_entrada: employee?.horario_entrada || '',
    horario_saida: employee?.horario_saida || '',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    employee?.foto_url || null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [horariosPreset, setHorariosPreset] = useState<any[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [nomeHorario, setNomeHorario] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const allCargos = [...new Set(existingCargos)].sort();

  React.useEffect(() => {
    const carregarHorarios = async () => {
      if (open) {
        setLoadingHorarios(true);
        try {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          // Novo endpoint que retorna presets usados pelos funcionários
          const response = await fetch(`${config.API_URL}/horarios/funcionarios`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            // data é um array de strings: ["Padrão", "Manhã", "Noite"]
            setHorariosPreset(data);
          }
        } catch (error) {
          console.error('Erro ao carregar horários:', error);
        } finally {
          setLoadingHorarios(false);
        }
      }
    };
    carregarHorarios();
  }, [open]);

  React.useEffect(() => {
    if (employee) {
      setFormData({
        nome: employee.nome,
        cargo: employee.cargo,
        senha: '',
        confirmarSenha: '',
        horario_entrada: employee.horario_entrada || '',
        horario_saida: employee.horario_saida || '',
      });
      setPhotoPreview(employee.foto_url);
    } else {
      setFormData({ 
        nome: '', 
        cargo: '', 
        senha: '',
        confirmarSenha: '',
        horario_entrada: '', 
        horario_saida: '' 
      });
      setPhoto(null);
      setPhotoPreview(null);
      setNomeHorario('');
    }
    setErrors({});
  }, [employee, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleCargoChange = (event: any, newValue: string | null) => {
    setFormData(prev => ({
      ...prev,
      cargo: newValue || '',
    }));
    
    if (errors.cargo) {
      setErrors(prev => ({
        ...prev,
        cargo: '',
      }));
    }
  };

  const handleHorarioPresetChange = (event: any, newValue: HorarioPreset | string | null) => {
    if (typeof newValue === 'string' && newValue.trim()) {
      // Se é uma string (nome do preset), buscar os horários
      setNomeHorario(newValue);
      buscarHorariosPorNome(newValue);
    } else if (newValue && typeof newValue === 'object') {
      setFormData(prev => ({
        ...prev,
        horario_entrada: newValue.horario_entrada,
        horario_saida: newValue.horario_saida,
      }));
      setNomeHorario(newValue.nome);
    } else {
      setNomeHorario('');
    }
  };

  const buscarHorariosPorNome = async (nomeHorario: string) => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/horarios/${encodeURIComponent(nomeHorario)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const horario = await response.json();
        setFormData(prev => ({
          ...prev,
          horario_entrada: horario.horario_entrada,
          horario_saida: horario.horario_saida,
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.cargo.trim()) {
      newErrors.cargo = 'Cargo é obrigatório';
    }

    if (formData.senha && formData.senha.trim()) {
      if (formData.senha.length < 6) {
        newErrors.senha = 'Senha deve ter no mínimo 6 caracteres';
      }
      if (formData.senha !== formData.confirmarSenha) {
        newErrors.confirmarSenha = 'As senhas não coincidem';
      }
    }

    if (!employee && !photo) {
      newErrors.photo = 'Foto é obrigatória para novos funcionários';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('nome', formData.nome);
    formDataToSend.append('cargo', formData.cargo);

    // Gerar login e id: primeiro nome em minúsculo + _ + número aleatório
    // Normalizar primeiro nome (remover acentos e caracteres especiais)
    let firstName = formData.nome.trim().split(' ')[0]?.toLowerCase() || 'user';
    firstName = firstName.normalize('NFD').replace(/[^a-z0-9_]/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
    const login = `${firstName}_${randomNum}`;
    formDataToSend.append('login', login);
    formDataToSend.append('id', login);

    if (formData.senha && formData.senha.trim()) {
      formDataToSend.append('senha', formData.senha);
    }

    if (photo) {
      formDataToSend.append('foto', photo);
    }

    if (formData.horario_entrada) {
      formDataToSend.append('horario_entrada', formData.horario_entrada);
    }
    if (formData.horario_saida) {
      formDataToSend.append('horario_saida', formData.horario_saida);
    }
    if (nomeHorario) {
      formDataToSend.append('nome_horario', nomeHorario);
    }

    await onSubmit(formDataToSend);
  };

  const handleClose = () => {
    setFormData({ 
      nome: '', 
      cargo: '', 
      senha: '',
      confirmarSenha: '',
      horario_entrada: '', 
      horario_saida: '' 
    });
    setPhoto(null);
    setPhotoPreview(null);
    setNomeHorario('');
    setErrors({});
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason === 'backdropClick') return;
        if (reason === 'escapeKeyDown') return;
        handleClose();
      }}
      disableEscapeKeyDown
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }
      }}
      sx={{
        '& .MuiDialog-container': {
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          color: 'white',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          pb: 2,
          fontWeight: 600
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }} component="span">
          <PersonIcon sx={{ color: 'rgba(255, 255, 255, 0.9)' }} />
          <Box component="span">
            {employee ? 'Editar Funcionário' : 'Cadastrar Funcionário'}
          </Box>
        </Box>
        <IconButton 
          onClick={handleClose} 
          disabled={loading}
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              color: 'white',
              background: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Photo Section */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={photoPreview || undefined}
                sx={{ width: 120, height: 120, background: 'rgba(255, 255, 255, 0.1)' }}
              >
                {!photoPreview && <PersonIcon sx={{ fontSize: 60, color: 'rgba(255, 255, 255, 0.5)' }} />}
              </Avatar>
              
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="photo-upload"
                type="file"
                onChange={handlePhotoChange}
                disabled={loading}
              />
              <label htmlFor="photo-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<PhotoCameraIcon />}
                  disabled={loading}
                  sx={{
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.8)',
                      background: 'rgba(255, 255, 255, 0.05)',
                    }
                  }}
                >
                  {photo ? 'Alterar Foto' : 'Adicionar Foto'}
                </Button>
              </label>
              
              {errors.photo && (
                <Typography variant="caption" sx={{ color: '#ef4444' }}>
                  {errors.photo}
                </Typography>
              )}
            </Box>

            {/* Name Field */}
            <TextField
              fullWidth
              label="Nome Completo"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              error={!!errors.nome}
              helperText={errors.nome}
              disabled={loading}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  background: 'rgba(255, 255, 255, 0.05)',
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.7)',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': {
                    color: 'rgba(255, 255, 255, 0.9)'
                  }
                },
              }}
            />

            {/* Cargo Field */}
            <Autocomplete
              freeSolo
              options={allCargos}
              value={formData.cargo}
              onChange={handleCargoChange}
              onInputChange={(event, newInputValue) => {
                setFormData(prev => ({
                  ...prev,
                  cargo: newInputValue,
                }));
              }}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cargo"
                  error={!!errors.cargo}
                  helperText={errors.cargo || "Selecione ou digite o cargo"}
                  variant="outlined"
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      background: 'rgba(255, 255, 255, 0.05)',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.7)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': {
                        color: 'rgba(255, 255, 255, 0.9)'
                      }
                    },
                    '& .MuiAutocomplete-popupIndicator': {
                      color: 'rgba(255, 255, 255, 0.7)'
                    }
                  }}
                />
              )}
              ListboxProps={{
                sx: {
                  background: 'rgba(15, 23, 42, 0.95)',
                  color: 'white',
                  '& .MuiAutocomplete-option': {
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(59, 130, 246, 0.35)'
                    }
                  }
                }
              }}
            />

            {/* Password Section */}
            <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                Acesso ao App Mobile (Opcional)
              </Typography>
              
              <TextField
                fullWidth
                label={employee ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha'}
                name="senha"
                type={showPassword ? "text" : "password"}
                value={formData.senha}
                onChange={handleChange}
                error={!!errors.senha}
                helperText={
                  errors.senha || 
                  (employee 
                    ? 'Preencha apenas se quiser redefinir a senha. Mínimo 6 caracteres.'
                    : 'Mínimo 6 caracteres. Deixe em branco para não dar acesso ao app.')
                }
                disabled={loading}
                variant="outlined"
                autoComplete="new-password"
                InputProps={{
                  endAdornment: formData.senha && (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    background: 'rgba(255, 255, 255, 0.05)',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.7)',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: 'rgba(255, 255, 255, 0.9)'
                    }
                  },
                  '& .MuiFormHelperText-root': {
                    color: 'rgba(255, 255, 255, 0.6)'
                  }
                }}
              />

              {formData.senha && (
                <TextField
                  fullWidth
                  label="Confirmar Senha"
                  name="confirmarSenha"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmarSenha}
                  onChange={handleChange}
                  error={!!errors.confirmarSenha}
                  helperText={errors.confirmarSenha}
                  disabled={loading}
                  variant="outlined"
                  autoComplete="new-password"
                  InputProps={{
                    endAdornment: formData.confirmarSenha && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                          sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                        >
                          {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mt: 2,
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      background: 'rgba(255, 255, 255, 0.05)',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.7)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': {
                        color: 'rgba(255, 255, 255, 0.9)'
                      }
                    },
                    '& .MuiFormHelperText-root': {
                      color: 'rgba(255, 255, 255, 0.6)'
                    }
                  }}
                />
              )}
            </Box>

            {/* Horários Section */}
            <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                Horários de Trabalho
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Horário de Entrada"
                  name="horario_entrada"
                  type="time"
                  value={formData.horario_entrada}
                  onChange={handleChange}
                  disabled={loading}
                  variant="outlined"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      background: 'rgba(255, 255, 255, 0.05)',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.7)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': {
                        color: 'rgba(255, 255, 255, 0.9)'
                      }
                    },
                    '& .MuiInputBase-input': {
                      color: 'white',
                    },
                    '& input[type="time"]::-webkit-calendar-picker-indicator': {
                      filter: 'invert(1) brightness(0.7)',
                    },
                  }}
                />
                
                <TextField
                  fullWidth
                  label="Horário de Saída"
                  name="horario_saida"
                  type="time"
                  value={formData.horario_saida}
                  onChange={handleChange}
                  disabled={loading}
                  variant="outlined"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      background: 'rgba(255, 255, 255, 0.05)',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.7)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': {
                        color: 'rgba(255, 255, 255, 0.9)'
                      }
                    },
                    '& .MuiInputBase-input': {
                      color: 'white',
                    },
                    '& input[type="time"]::-webkit-calendar-picker-indicator': {
                      filter: 'invert(1) brightness(0.7)',
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button
            onClick={handleClose}
            disabled={loading}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white'
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonIcon />}
            sx={{ 
              background: '#2563eb',
              color: 'white',
              fontWeight: 600,
              px: 3,
              '&:hover': {
                background: '#1d4ed8',
              },
              '&:disabled': {
                background: 'rgba(255, 255, 255, 0.1)',
              }
            }}
          >
            {loading ? 'Salvando...' : employee ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EmployeeForm;
