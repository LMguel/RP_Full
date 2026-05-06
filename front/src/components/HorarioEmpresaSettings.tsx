import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  Grid,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { DiaSemana, HorarioDiaConfig, HorarioPreset } from '../types';

interface EmployeeWithoutPreset {
  id: string;
  nome: string;
  cargo?: string;
}

interface HorarioFormData {
  nome: string;
  horarios: Record<DiaSemana, HorarioDiaConfig>;
}

const WEEK_DAYS: Array<{ key: DiaSemana; label: string; short: string }> = [
  { key: 'segunda', label: 'Segunda', short: 'Seg' },
  { key: 'terca', label: 'Terca', short: 'Ter' },
  { key: 'quarta', label: 'Quarta', short: 'Qua' },
  { key: 'quinta', label: 'Quinta', short: 'Qui' },
  { key: 'sexta', label: 'Sexta', short: 'Sex' },
  { key: 'sabado', label: 'Sabado', short: 'Sab' },
  { key: 'domingo', label: 'Domingo', short: 'Dom' },
];

const DEFAULT_START = '08:00';
const DEFAULT_END = '18:00';

const buildDefaultSchedule = (start = DEFAULT_START, end = DEFAULT_END) => {
  return WEEK_DAYS.reduce((acc, day) => {
    acc[day.key] = { entrada: start, saida: end, ativo: true };
    return acc;
  }, {} as Record<DiaSemana, HorarioDiaConfig>);
};

const buildScheduleFromPreset = (preset?: HorarioPreset) => {
  if (preset?.horarios) {
    return preset.horarios;
  }
  if (preset?.horario_entrada && preset?.horario_saida) {
    return buildDefaultSchedule(preset.horario_entrada, preset.horario_saida);
  }
  return buildDefaultSchedule();
};

const getFirstActiveTimes = (horarios: Record<DiaSemana, HorarioDiaConfig>) => {
  for (const day of WEEK_DAYS) {
    const dayData = horarios[day.key];
    if (dayData?.ativo && dayData.entrada && dayData.saida) {
      return { entrada: dayData.entrada, saida: dayData.saida };
    }
  }
  return { entrada: null, saida: null };
};

const buildScheduleSummary = (preset: HorarioPreset) => {
  const horarios = preset.horarios || (preset.horario_entrada && preset.horario_saida
    ? buildDefaultSchedule(preset.horario_entrada, preset.horario_saida)
    : null);

  if (!horarios) {
    return 'Horario nao definido';
  }

  const activeDays = WEEK_DAYS.filter(day => horarios[day.key]?.ativo);
  if (activeDays.length === 0) {
    return 'Sem dias ativos';
  }

  const first = horarios[activeDays[0].key];
  const allSame = activeDays.every(day => {
    const current = horarios[day.key];
    return current?.entrada === first?.entrada && current?.saida === first?.saida;
  });

  if (allSame && first?.entrada && first?.saida) {
    const daysLabel = activeDays.length === 7
      ? 'Seg a Dom'
      : activeDays.map(day => day.short).join(', ');
    return `${daysLabel}: ${first.entrada} - ${first.saida}`;
  }

  return 'Varia por dia';
};

const HorarioEmpresaSettings: React.FC = () => {
  const [horarios, setHorarios] = useState<HorarioPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<HorarioPreset | null>(null);
  const [employeesWithoutPreset, setEmployeesWithoutPreset] = useState<EmployeeWithoutPreset[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [formData, setFormData] = useState<HorarioFormData>({
    nome: '',
    horarios: buildDefaultSchedule(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadHorarios();
  }, []);

  const loadHorarios = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/horarios');
      // Garantir que seja sempre um array
      const horariosData = Array.isArray(response) ? response : (response?.horarios || []);
      setHorarios(horariosData);
    } catch (err: any) {
      console.error('Error loading horarios:', err);
      toast.error('Erro ao carregar horários pré-definidos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (horario?: HorarioPreset) => {
    if (horario) {
      setEditingHorario(horario);
      setFormData({
        nome: horario.nome,
        horarios: buildScheduleFromPreset(horario),
      });
    } else {
      setEditingHorario(null);
      setFormData({
        nome: '',
        horarios: buildDefaultSchedule(),
      });
    }
    loadEmployeesWithoutPreset();
    setSelectedEmployees([]);
    setErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingHorario(null);
    setFormData({
      nome: '',
      horarios: buildDefaultSchedule(),
    });
    setEmployeesWithoutPreset([]);
    setSelectedEmployees([]);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome do horário é obrigatório';
    }

    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    let hasActiveDay = false;

    WEEK_DAYS.forEach((day) => {
      const dayData = formData.horarios[day.key];
      if (!dayData) {
        return;
      }
      if (dayData.ativo) {
        hasActiveDay = true;
        if (!dayData.entrada || !dayData.saida) {
          newErrors[day.key] = 'Entrada e saida sao obrigatorias';
          return;
        }
        if (!timePattern.test(dayData.entrada) || !timePattern.test(dayData.saida)) {
          newErrors[day.key] = 'Formato invalido. Use HH:MM';
        }
      }
    });

    if (!hasActiveDay) {
      newErrors.horarios = 'Selecione ao menos um dia ativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDayToggle = (dayKey: DiaSemana, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      horarios: {
        ...prev.horarios,
        [dayKey]: {
          ...prev.horarios[dayKey],
          ativo: checked,
          entrada: checked ? (prev.horarios[dayKey]?.entrada || DEFAULT_START) : null,
          saida: checked ? (prev.horarios[dayKey]?.saida || DEFAULT_END) : null,
        }
      }
    }));
  };

  const handleDayTimeChange = (dayKey: DiaSemana, field: 'entrada' | 'saida', value: string) => {
    setFormData((prev) => ({
      ...prev,
      horarios: {
        ...prev.horarios,
        [dayKey]: {
          ...prev.horarios[dayKey],
          [field]: value,
        }
      }
    }));
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      const { entrada, saida } = getFirstActiveTimes(formData.horarios);
      await apiService.post('/api/horarios', {
        nome: formData.nome.trim(),
        horarios: formData.horarios,
        horario_entrada: entrada,
        horario_saida: saida,
      });

      if (selectedEmployees.length > 0) {
        await apiService.post('/api/horarios/aplicar', {
          nome: formData.nome.trim(),
          funcionarios: selectedEmployees,
        });
      }

      toast.success(editingHorario 
        ? 'Horário atualizado com sucesso!' 
        : 'Horário criado com sucesso!'
      );
      
      handleCloseDialog();
      loadHorarios();
    } catch (err: any) {
      console.error('Error saving horario:', err);
      toast.error('Erro ao salvar horário');
    } finally {
      setSaving(false);
    }
  };

  const loadEmployeesWithoutPreset = async () => {
    try {
      const response = await apiService.get('/api/horarios/funcionarios/sem-preset');
      const data = Array.isArray(response) ? response : (response?.funcionarios || []);
      setEmployeesWithoutPreset(data);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        // Backend ainda nao suporta este endpoint; segue com lista vazia.
        setEmployeesWithoutPreset([]);
        return;
      }
      console.error('Error loading employees without preset:', err);
      setEmployeesWithoutPreset([]);
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees((prev) => (
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    ));
  };

  const handleDelete = async (horario: HorarioPreset) => {
    if (!window.confirm(`Tem certeza que deseja excluir o horário "${horario.nome}"?`)) {
      return;
    }

    try {
      await apiService.delete(`/api/horarios/${encodeURIComponent(horario.nome)}`);
      toast.success('Horário excluído com sucesso!');
      loadHorarios();
    } catch (err: any) {
      console.error('Error deleting horario:', err);
      toast.error('Erro ao excluir horário');
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
    <>
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ScheduleIcon sx={{ color: '#3b82f6', fontSize: '24px' }} />
              <Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600,
                    color: 'white',
                    fontSize: '18px'
                  }}
                >
                  Horários da Empresa
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '14px'
                  }}
                >
                  Defina horários pré-configurados para os funcionários
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                },
              }}
            >
              Adicionar Horário
            </Button>
          </Box>

          {!Array.isArray(horarios) || horarios.length === 0 ? (
            <Box 
              sx={{ 
                p: 4, 
                textAlign: 'center',
                border: '2px dashed rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
              }}
            >
              <ScheduleIcon sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.3)', mb: 2 }} />
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Nenhum horário pré-definido cadastrado.
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px', mt: 1 }}>
                Clique no botão acima para adicionar um novo horário.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {Array.isArray(horarios) && horarios.map((horario) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={horario.id || horario.nome}>
                  <Box
                    sx={{
                      p: 2,
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.2s',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography 
                          sx={{ 
                            fontWeight: 600, 
                            color: 'white',
                            fontSize: '16px',
                            mb: 0.5
                          }}
                        >
                          {horario.nome}
                        </Typography>
                        <Chip
                          icon={<ScheduleIcon sx={{ fontSize: '16px !important' }} />}
                          label={buildScheduleSummary(horario)}
                          size="small"
                          sx={{
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            fontWeight: 500,
                            '& .MuiChip-icon': {
                              color: '#60a5fa',
                            },
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(horario)}
                          sx={{ 
                            color: 'rgba(255, 255, 255, 0.6)',
                            '&:hover': { 
                              color: '#3b82f6',
                              background: 'rgba(59, 130, 246, 0.1)'
                            }
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(horario)}
                          sx={{ 
                            color: 'rgba(255, 255, 255, 0.6)',
                            '&:hover': { 
                              color: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.1)'
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Dialog para adicionar/editar horário */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
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
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon sx={{ color: '#3b82f6' }} />
            {editingHorario ? 'Editar Horário' : 'Novo Horário'}
          </Box>
          <IconButton 
            onClick={handleCloseDialog}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Nome do Horário"
              placeholder="Ex: Professor, Administrativo, Manhã..."
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              error={!!errors.nome}
              helperText={errors.nome}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': { color: '#3b82f6' }
                },
              }}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {errors.horarios && (
                <Typography sx={{ color: '#ef4444', fontSize: '12px' }}>
                  {errors.horarios}
                </Typography>
              )}

              {WEEK_DAYS.map((day) => {
                const dayData = formData.horarios[day.key];
                const dayError = errors[day.key];
                return (
                  <Box key={day.key} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 2, alignItems: 'center' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={dayData?.ativo || false}
                          onChange={(e) => handleDayToggle(day.key, e.target.checked)}
                          sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
                        />
                      }
                      label={day.label}
                      sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                    />

                    <TextField
                      fullWidth
                      label="Entrada"
                      type="time"
                      value={dayData?.entrada || ''}
                      onChange={(e) => handleDayTimeChange(day.key, 'entrada', e.target.value)}
                      disabled={!dayData?.ativo}
                      error={!!dayError}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                          '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                          '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                        },
                        '& .MuiInputLabel-root': {
                          color: 'rgba(255, 255, 255, 0.7)',
                          '&.Mui-focused': { color: '#3b82f6' }
                        },
                        '& input[type="time"]::-webkit-calendar-picker-indicator': {
                          filter: 'invert(1) brightness(0.7)',
                        },
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Saida"
                      type="time"
                      value={dayData?.saida || ''}
                      onChange={(e) => handleDayTimeChange(day.key, 'saida', e.target.value)}
                      disabled={!dayData?.ativo}
                      error={!!dayError}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                          '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                          '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                        },
                        '& .MuiInputLabel-root': {
                          color: 'rgba(255, 255, 255, 0.7)',
                          '&.Mui-focused': { color: '#3b82f6' }
                        },
                        '& input[type="time"]::-webkit-calendar-picker-indicator': {
                          filter: 'invert(1) brightness(0.7)',
                        },
                      }}
                    />

                    {dayError && (
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography sx={{ color: '#ef4444', fontSize: '12px', ml: 1 }}>
                          {dayError}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>

            {formData.nome && (
              <Box
                sx={{
                  p: 2,
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', mb: 0.5 }}>
                  Pre-visualizacao:
                </Typography>
                <Typography sx={{ color: '#60a5fa', fontWeight: 600 }}>
                  {formData.nome}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                p: 2,
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.03)'
              }}
            >
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600, mb: 1 }}>
                Funcionarios sem horario pre-definido
              </Typography>
              {employeesWithoutPreset.length === 0 ? (
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
                  Nenhum funcionario disponivel.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 180, overflowY: 'auto' }}>
                  {employeesWithoutPreset.map((emp) => (
                    <FormControlLabel
                      key={emp.id}
                      control={
                        <Checkbox
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => toggleEmployeeSelection(emp.id)}
                          sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
                        />
                      }
                      label={`${emp.nome}${emp.cargo ? ` - ${emp.cargo}` : ''}`}
                      sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button 
            onClick={handleCloseDialog}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : null}
            sx={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              },
            }}
          >
            {saving ? 'Salvando...' : editingHorario ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default HorarioEmpresaSettings;
