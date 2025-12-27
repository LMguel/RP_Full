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
  CircularProgress,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';
import { Employee } from '../types';

interface TimeRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    employee_id: string;
    data_hora: string;
    tipo: 'entrada' | 'saída';
  }) => Promise<void>;
  loading?: boolean;
  employees?: Employee[];
}

const TimeRecordForm: React.FC<TimeRecordFormProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  employees: propEmployees = [],
}) => {
  const [formData, setFormData] = useState({
    employee_id: '',
    data_hora: '',
    date: '', // YYYY-MM-DD
    time: '', // HH:MM
    tipo: 'entrada' as 'entrada' | 'saída',
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeInput, setEmployeeInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    if (open) {
      if (propEmployees.length > 0) {
        setEmployees([...propEmployees].sort((a, b) => a.nome.localeCompare(b.nome)));
      } else {
        loadEmployees();
      }
      
      const now = new Date();
      // Get current time in Brazil timezone and format for datetime-local input
      const brasiliaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
      const year = brasiliaTime.getFullYear();
      const month = String(brasiliaTime.getMonth() + 1).padStart(2, '0');
      const day = String(brasiliaTime.getDate()).padStart(2, '0');
      const hours = String(brasiliaTime.getHours()).padStart(2, '0');
      const minutes = String(brasiliaTime.getMinutes()).padStart(2, '0');
      setFormData(prev => ({
        ...prev,
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`,
      }));
      setEmployeeInput('');
    }
  }, [open, propEmployees]);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await apiService.getEmployees();
      const employeesList = response.funcionarios || [];
      const sortedEmployees = [...employeesList].sort((a: Employee, b: Employee) =>
        (a.nome || '').localeCompare(b.nome || '')
      );
      setEmployees(sortedEmployees);
    } catch (err) {
      console.error('Error loading employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.employee_id) {
      newErrors.employee_id = 'Funcionário é obrigatório';
    }

    if (!formData.date || !formData.time) {
      newErrors.data_hora = 'Data e hora são obrigatórias';
    } else {
      // Validações empresariais críticas
      const selectedDateTime = new Date(`${formData.date}T${formData.time}:00`);
      const now = new Date();
      
      // 1. Não pode registrar no futuro
      if (selectedDateTime > now) {
        newErrors.data_hora = 'Não é possível registrar ponto no futuro';
      }
      
      // 2. Não pode registrar muito no passado (mais de 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      if (selectedDateTime < thirtyDaysAgo) {
        newErrors.data_hora = 'Não é possível registrar ponto com mais de 30 dias';
      }
      
      // 3. Horário comercial básico (opcional - pode ser removido se necessário)
      const hour = selectedDateTime.getHours();
      if (hour < 5 || hour > 23) {
        newErrors.data_hora = 'Registro fora do horário permitido (05:00 - 23:59)';
      }
      
      // 4. Validar formato de data
      if (isNaN(selectedDateTime.getTime())) {
        newErrors.data_hora = 'Data e hora inválidas';
      }
    }

    if (!formData.tipo) {
      newErrors.tipo = 'Tipo de registro é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    // Garante que employee_id é de um funcionário válido
    const selectedEmployee = employees.find(emp => emp.id === formData.employee_id);
    if (!selectedEmployee) {
      setErrors(prev => ({ ...prev, employee_id: 'Selecione um funcionário válido da lista.' }));
      return;
    }
    try {
      // Validação adicional: verificar registros duplicados
      const selectedDate = new Date(`${formData.date}T${formData.time}:00`);
      const dateStr = formData.date;
      // Buscar registros existentes do funcionário na mesma data
      try {
        const existingRecords = await apiService.getTimeRecords({
          funcionario_id: formData.employee_id,
          inicio: dateStr,
          fim: dateStr
        });
        let recordsToCheck = [];
        if (Array.isArray(existingRecords)) {
          recordsToCheck = existingRecords;
        } else if (existingRecords && existingRecords.registros) {
          recordsToCheck = existingRecords.registros;
        }
        // Verificar se já existe um registro do mesmo tipo no mesmo dia
        const sameTypeRecords = recordsToCheck.filter((record: any) => 
          (record.type || record.tipo) === formData.tipo && 
          record.data_hora && 
          record.data_hora.includes(dateStr)
        );
        if (sameTypeRecords.length > 0) {
          setErrors(prev => ({
            ...prev,
            tipo: `Já existe um registro de ${formData.tipo} para este funcionário hoje`
          }));
          return;
        }
        // Verificar se não há conflito de horários próximos (menos de 30 minutos)
        const newDateTime = selectedDate.getTime();
        const conflictingRecords = recordsToCheck.filter((record: any) => {
          if (!record.data_hora) return false;
          const existingDateTime = new Date(record.data_hora).getTime();
          const timeDiff = Math.abs(newDateTime - existingDateTime);
          return timeDiff < (30 * 60 * 1000); // Menos de 30 minutos
        });
        if (conflictingRecords.length > 0) {
          setErrors(prev => ({
            ...prev,
            data_hora: 'Existe um registro muito próximo deste horário (menos de 30 minutos)'
          }));
          return;
        }
      } catch (checkError) {
        console.warn('⚠️ Não foi possível verificar registros existentes:', checkError);
        // Continua mesmo se não conseguir verificar (para não bloquear o sistema)
      }
      // Combine date and time into the format expected by backend: 'YYYY-MM-DD HH:MM:SS'
      const formattedDateTime = `${formData.date} ${formData.time}:00`;
      await onSubmit({
        employee_id: selectedEmployee.id,
        data_hora: formattedDateTime,
        tipo: formData.tipo,
      });
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
      setErrors(prev => ({
        ...prev,
        submit: 'Erro ao salvar registro. Tente novamente.'
      }));
    }
  };

  const handleClose = () => {
    setFormData({
      employee_id: '',
      data_hora: '',
      date: '',
      time: '',
      tipo: 'entrada',
    });
    setEmployeeInput('');
    setErrors({});
    onClose();
  };

  return (
    <Dialog
      open={open}
      // do not close on backdrop click; only on explicit actions
      onClose={(event, reason) => {
        if (reason === 'backdropClick') return;
        if (reason === 'escapeKeyDown') return; // disable ESC
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
          <AccessTimeIcon sx={{ color: 'rgba(255, 255, 255, 0.9)' }} />
          <Box component="span">
            Registrar Ponto Manual
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
          {loadingEmployees ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress sx={{ color: 'white' }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Autocomplete
                  options={employees}
                  getOptionLabel={(option) => option.nome || ''}
                  value={employees.find(emp => emp.id === formData.employee_id) || null}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  onChange={(_, newValue) => {
                    setFormData(prev => ({
                      ...prev,
                      employee_id: newValue ? newValue.id : '',
                    }));
                    if (!newValue && !employeeInput) {
                      setErrors(prev => ({ ...prev, employee_id: 'Funcionário é obrigatório' }));
                    } else {
                      setErrors(prev => {
                        const { employee_id, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  inputValue={employeeInput}
                  onInputChange={(_, newInputValue) => {
                    setEmployeeInput(newInputValue);
                    if (newInputValue) {
                      setErrors(prev => {
                        const { employee_id, ...rest } = prev;
                        return rest;
                      });
                    }
                    if (!newInputValue) {
                      setFormData(prev => ({ ...prev, employee_id: '' }));
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Funcionário"
                      placeholder="Digite o nome do funcionário"
                      error={!!errors.employee_id}
                      helperText={errors.employee_id}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                          {option.nome}
                        </Typography>
                        {option.cargo && (
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                            {option.cargo}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )}
                  disabled={loading}
                  loading={loadingEmployees}
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
                  noOptionsText={employeeInput ? 'Nenhum funcionário encontrado' : 'Digite o nome do funcionário'}
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
                    },
                    '& .MuiCircularProgress-root': {
                      color: 'white'
                    }
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  error={!!errors.data_hora}
                  helperText={errors.data_hora}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.7)',
                      },
                      background: 'rgba(255, 255, 255, 0.05)',
                    },
                    '& .MuiInputBase-input': {
                      color: 'white',
                    },
                    '& input[type="date"]::-webkit-calendar-picker-indicator': {
                      filter: 'invert(1) brightness(0.7)',
                    },
                  }}
                />

                <TextField
                  fullWidth
                  name="time"
                  type="time"
                  value={formData.time}
                  onChange={handleChange}
                  error={!!errors.data_hora}
                  helperText={errors.data_hora}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.7)',
                      },
                      background: 'rgba(255, 255, 255, 0.05)',
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

              <FormControl 
                fullWidth 
                error={!!errors.tipo}
                sx={{
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: 'rgba(255, 255, 255, 0.9)'
                    }
                  },
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.7)',
                    },
                    background: 'rgba(255, 255, 255, 0.05)',
                  },
                  '& .MuiSelect-icon': {
                    color: 'rgba(255, 255, 255, 0.7)'
                  }
                }}
              >
                <InputLabel>Tipo de Registro</InputLabel>
                <Select
                  name="tipo"
                  value={formData.tipo}
                  onChange={(event) => {
                    const value = event.target.value as 'entrada' | 'saída';
                    setFormData(prev => ({
                      ...prev,
                      tipo: value,
                    }));
                    if (errors.tipo) {
                      setErrors(prev => {
                        const { tipo, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  label="Tipo de Registro"
                  disabled={loading}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                      }
                    }
                  }}
                >
                  <MenuItem value="entrada">Entrada</MenuItem>
                  <MenuItem value="saída">Saída</MenuItem>
                </Select>
                {errors.tipo && (
                  <Typography variant="caption" sx={{ color: '#ef4444', mt: 1 }}>
                    {errors.tipo}
                  </Typography>
                )}
              </FormControl>
            </Box>
          )}
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
            disabled={loading || loadingEmployees}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AccessTimeIcon />}
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
            {loading ? 'Registrando...' : 'Registrar Ponto'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TimeRecordForm;