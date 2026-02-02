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
import { HorarioPreset } from '../types';

interface HorarioFormData {
  nome: string;
  horario_entrada: string;
  horario_saida: string;
}

const HorarioEmpresaSettings: React.FC = () => {
  const [horarios, setHorarios] = useState<HorarioPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<HorarioPreset | null>(null);
  const [formData, setFormData] = useState<HorarioFormData>({
    nome: '',
    horario_entrada: '',
    horario_saida: '',
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
        horario_entrada: horario.horario_entrada,
        horario_saida: horario.horario_saida,
      });
    } else {
      setEditingHorario(null);
      setFormData({
        nome: '',
        horario_entrada: '',
        horario_saida: '',
      });
    }
    setErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingHorario(null);
    setFormData({
      nome: '',
      horario_entrada: '',
      horario_saida: '',
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome do horário é obrigatório';
    }

    if (!formData.horario_entrada) {
      newErrors.horario_entrada = 'Horário de entrada é obrigatório';
    }

    if (!formData.horario_saida) {
      newErrors.horario_saida = 'Horário de saída é obrigatório';
    }

    // Validar formato HH:MM
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (formData.horario_entrada && !timePattern.test(formData.horario_entrada)) {
      newErrors.horario_entrada = 'Formato inválido. Use HH:MM';
    }
    if (formData.horario_saida && !timePattern.test(formData.horario_saida)) {
      newErrors.horario_saida = 'Formato inválido. Use HH:MM';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      await apiService.post('/api/horarios', {
        nome: formData.nome.trim(),
        horario_entrada: formData.horario_entrada,
        horario_saida: formData.horario_saida,
      });

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
                          label={`${horario.horario_entrada} - ${horario.horario_saida}`}
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

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                fullWidth
                label="Horário de Entrada"
                type="time"
                value={formData.horario_entrada}
                onChange={(e) => setFormData({ ...formData, horario_entrada: e.target.value })}
                error={!!errors.horario_entrada}
                helperText={errors.horario_entrada}
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
                label="Horário de Saída"
                type="time"
                value={formData.horario_saida}
                onChange={(e) => setFormData({ ...formData, horario_saida: e.target.value })}
                error={!!errors.horario_saida}
                helperText={errors.horario_saida}
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
            </Box>

            {formData.nome && formData.horario_entrada && formData.horario_saida && (
              <Box 
                sx={{ 
                  p: 2, 
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', mb: 0.5 }}>
                  Pré-visualização:
                </Typography>
                <Typography sx={{ color: '#60a5fa', fontWeight: 600 }}>
                  {formData.nome}: {formData.horario_entrada} - {formData.horario_saida}
                </Typography>
              </Box>
            )}
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
