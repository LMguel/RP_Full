import React, { useState } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Schedule as ScheduleIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { DiaSemana, Employee, HorarioDiaConfig, HorarioPreset, WeeklyScheduleMap } from '../types';
import { config } from '../config';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS_WITH_LABELS: Array<{ key: DiaSemana; label: string }> = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca',   label: 'Terça-feira'   },
  { key: 'quarta',  label: 'Quarta-feira'  },
  { key: 'quinta',  label: 'Quinta-feira'  },
  { key: 'sexta',   label: 'Sexta-feira'   },
  { key: 'sabado',  label: 'Sábado'        },
  { key: 'domingo', label: 'Domingo'       },
];

const WEEK_DAYS_KEYS: DiaSemana[] = WEEK_DAYS_WITH_LABELS.map(d => d.key);

const weekdayToDia: Record<string, DiaSemana> = {
  mon: 'segunda', tue: 'terca', wed: 'quarta', thu: 'quinta',
  fri: 'sexta', sat: 'sabado', sun: 'domingo',
};

function buildDefaultSchedule(): Record<DiaSemana, HorarioDiaConfig> {
  return {
    segunda: { entrada: '08:00', saida: '17:00', ativo: true  },
    terca:   { entrada: '08:00', saida: '17:00', ativo: true  },
    quarta:  { entrada: '08:00', saida: '17:00', ativo: true  },
    quinta:  { entrada: '08:00', saida: '17:00', ativo: true  },
    sexta:   { entrada: '08:00', saida: '17:00', ativo: true  },
    sabado:  { entrada: null,    saida: null,    ativo: false },
    domingo: { entrada: null,    saida: null,    ativo: false },
  };
}

function buildEmptySchedule(): Record<DiaSemana, HorarioDiaConfig> {
  return WEEK_DAYS_KEYS.reduce((acc, day) => {
    acc[day] = { entrada: null, saida: null, ativo: false };
    return acc;
  }, {} as Record<DiaSemana, HorarioDiaConfig>);
}

function buildScheduleFromLegacy(entrada: string, saida: string): Record<DiaSemana, HorarioDiaConfig> {
  return {
    segunda: { entrada, saida, ativo: true  },
    terca:   { entrada, saida, ativo: true  },
    quarta:  { entrada, saida, ativo: true  },
    quinta:  { entrada, saida, ativo: true  },
    sexta:   { entrada, saida, ativo: true  },
    sabado:  { entrada: null, saida: null, ativo: false },
    domingo: { entrada: null, saida: null, ativo: false },
  };
}

function buildScheduleFromCustom(cs: WeeklyScheduleMap): Record<DiaSemana, HorarioDiaConfig> {
  const result = buildEmptySchedule();
  Object.entries(cs).forEach(([wk, dayData]) => {
    const dia = weekdayToDia[wk];
    if (dia && dayData) {
      result[dia] = {
        entrada: dayData.start || null,
        saida:   dayData.end   || null,
        ativo:   dayData.active !== false,
      };
    }
  });
  return result;
}

// ─── Shared sx styles ─────────────────────────────────────────────────────────

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    background: 'rgba(255, 255, 255, 0.05)',
    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
    '&.Mui-focused fieldset': { borderColor: 'rgba(255, 255, 255, 0.7)' },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.7)',
    '&.Mui-focused': { color: 'rgba(255, 255, 255, 0.9)' },
  },
  '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.6)' },
};

const timeInputSx = {
  ...inputSx,
  '& .MuiInputBase-input': { color: 'white' },
  '& input[type="time"]::-webkit-calendar-picker-indicator': {
    filter: 'invert(1) brightness(0.7)',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface EmployeeFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  employee?: Employee | null;
  loading?: boolean;
  existingCargos?: string[];
  companySettings?: any;
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
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(employee?.foto_url || null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [horariosPreset, setHorariosPreset] = useState<HorarioPreset[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [nomeHorario, setNomeHorario] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [intervaloPersonalizado, setIntervaloPersonalizado] = useState<boolean>(employee?.intervalo_personalizado || false);
  const [intervaloEmp, setIntervaloEmp] = useState<string>(employee?.intervalo_emp?.toString() || '');
  // Intervalo padrão (minutos). 0 é válido. Default 60 para novos com horário fixo.
  const [intervaloPadrao, setIntervaloPadrao] = useState<string>(
    employee?.intervalo_padrao_minutos !== undefined && employee?.intervalo_padrao_minutos !== null
      ? String(employee.intervalo_padrao_minutos)
      : (employee ? '' : '60')
  );
  const [tipoHorario, setTipoHorario] = useState<'fixo' | 'variavel'>(
    employee?.horario_entrada ? 'fixo' : 'variavel'
  );
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [horariosPorDia, setHorariosPorDia] = useState<Record<DiaSemana, HorarioDiaConfig>>(buildDefaultSchedule());

  const allCargos = [...new Set(existingCargos)].sort();

  // Load preset schedules when dialog opens
  React.useEffect(() => {
    if (!open) return;
    const carregarHorarios = async () => {
      setLoadingHorarios(true);
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`${config.API_URL}/api/horarios`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setHorariosPreset(Array.isArray(data) ? data : []);
        } else {
          setHorariosPreset([]);
        }
      } catch {
        setHorariosPreset([]);
      } finally {
        setLoadingHorarios(false);
      }
    };
    carregarHorarios();
  }, [open]);

  // Populate form when employee data changes
  React.useEffect(() => {
    if (employee) {
      setFormData({ nome: employee.nome, cargo: employee.cargo, senha: '', confirmarSenha: '' });
      setPhotoPreview(employee.foto_url);
      setIntervaloPersonalizado(!!employee.intervalo_personalizado);
      setIntervaloEmp(employee.intervalo_emp ? employee.intervalo_emp.toString() : '');
      setIntervaloPadrao(
        employee.intervalo_padrao_minutos !== undefined && employee.intervalo_padrao_minutos !== null
          ? String(employee.intervalo_padrao_minutos)
          : (employee.intervalo_emp ? String(employee.intervalo_emp) : '60')
      );
      setTipoHorario(employee.horario_entrada ? 'fixo' : 'variavel');

      const predHora = employee.pred_hora || '';
      setSelectedPreset(predHora);
      setNomeHorario(predHora);

      if (employee.custom_schedule && Object.keys(employee.custom_schedule).length > 0) {
        setHorariosPorDia(buildScheduleFromCustom(employee.custom_schedule));
      } else if (employee.horario_entrada && employee.horario_saida) {
        setHorariosPorDia(buildScheduleFromLegacy(employee.horario_entrada, employee.horario_saida));
      } else {
        setHorariosPorDia(buildDefaultSchedule());
      }
    } else {
      setFormData({ nome: '', cargo: '', senha: '', confirmarSenha: '' });
      setPhoto(null);
      setPhotoPreview(null);
      setNomeHorario('');
      setTipoHorario('variavel');
      setSelectedPreset('');
      setHorariosPorDia(buildDefaultSchedule());
      setIntervaloPersonalizado(false);
      setIntervaloEmp('');
      setIntervaloPadrao('60');
    }
    setErrors({});
  }, [employee, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleCargoChange = (_event: any, newValue: string | null) => {
    setFormData(prev => ({ ...prev, cargo: newValue || '' }));
    if (errors.cargo) setErrors(prev => ({ ...prev, cargo: '' }));
  };

  const handleHorarioPresetChange = (presetNome: string) => {
    setSelectedPreset(presetNome);
    if (!presetNome) {
      setNomeHorario('');
      return;
    }
    const preset = horariosPreset.find(h => h.nome === presetNome);
    if (preset) {
      setNomeHorario(preset.nome);
      if (preset.horarios) {
        setHorariosPorDia({ ...buildEmptySchedule(), ...(preset.horarios as Record<DiaSemana, HorarioDiaConfig>) });
      } else if (preset.horario_entrada && preset.horario_saida) {
        setHorariosPorDia(buildScheduleFromLegacy(preset.horario_entrada, preset.horario_saida));
      }
    }
  };

  const handleTipoHorarioChange = (_event: React.MouseEvent<HTMLElement>, newTipo: 'fixo' | 'variavel' | null) => {
    if (newTipo !== null) {
      setTipoHorario(newTipo);
      if (newTipo === 'variavel') {
        setSelectedPreset('');
        setNomeHorario('');
      }
    }
  };

  const handleDayToggle = (dayKey: DiaSemana, checked: boolean) => {
    setHorariosPorDia(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        ativo: checked,
        entrada: checked ? (prev[dayKey]?.entrada || '08:00') : null,
        saida:   checked ? (prev[dayKey]?.saida   || '17:00') : null,
      },
    }));
  };

  const handleDayTimeChange = (dayKey: DiaSemana, field: 'entrada' | 'saida', value: string) => {
    setHorariosPorDia(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!formData.cargo.trim()) newErrors.cargo = 'Cargo é obrigatório';
    if (formData.senha?.trim()) {
      if (formData.senha.length < 6) newErrors.senha = 'Senha deve ter no mínimo 6 caracteres';
      if (formData.senha !== formData.confirmarSenha) newErrors.confirmarSenha = 'As senhas não coincidem';
    }
    if (!employee && !photo) newErrors.photo = 'Foto é obrigatória para novos funcionários';
    if (tipoHorario === 'fixo') {
      const hasActiveDay = WEEK_DAYS_KEYS.some(d => horariosPorDia[d]?.ativo);
      if (!hasActiveDay) newErrors.horarios = 'Selecione ao menos um dia de trabalho';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const formDataToSend = new FormData();
    formDataToSend.append('nome', formData.nome);
    formDataToSend.append('cargo', formData.cargo);

    // Generate login/id only for new employees — never change it on edit
    if (!employee) {
      let firstName = formData.nome.trim().split(' ')[0]?.toLowerCase() || 'user';
      firstName = firstName.normalize('NFD').replace(/[^a-z0-9_]/g, '');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const login = `${firstName}_${randomNum}`;
      formDataToSend.append('login', login);
      formDataToSend.append('id', login);
    }

    if (formData.senha?.trim()) formDataToSend.append('senha', formData.senha);
    if (photo) formDataToSend.append('foto', photo);

    formDataToSend.append('intervalo_personalizado', intervaloPersonalizado ? 'true' : 'false');
    if (intervaloPersonalizado && intervaloEmp) formDataToSend.append('intervalo_emp', intervaloEmp);

    formDataToSend.append('tipo_horario', tipoHorario);

    if (tipoHorario === 'fixo') {
      formDataToSend.append('horarios_json', JSON.stringify(horariosPorDia));
      if (nomeHorario) formDataToSend.append('nome_horario', nomeHorario);

      const firstActiveDay = WEEK_DAYS_KEYS.find(d => horariosPorDia[d]?.ativo);
      if (firstActiveDay) {
        const cfg = horariosPorDia[firstActiveDay];
        if (cfg?.entrada) formDataToSend.append('horario_entrada', cfg.entrada);
        if (cfg?.saida)   formDataToSend.append('horario_saida',   cfg.saida);
      }

      // Intervalo padrão em minutos (0 é válido = sem intervalo)
      const ipNum = intervaloPadrao.trim() === '' ? 60 : Math.max(0, parseInt(intervaloPadrao) || 0);
      formDataToSend.append('intervalo_padrao_minutos', String(ipNum));
    }

    await onSubmit(formDataToSend);
  };

  const handleClose = () => {
    setFormData({ nome: '', cargo: '', senha: '', confirmarSenha: '' });
    setPhoto(null);
    setPhotoPreview(null);
    setNomeHorario('');
    setTipoHorario('variavel');
    setSelectedPreset('');
    setHorariosPorDia(buildDefaultSchedule());
    setIntervaloPersonalizado(false);
    setIntervaloEmp('');
    setErrors({});
    onClose();
  };

  // Format preset summary for dropdown
  const formatPresetSummary = (preset: HorarioPreset) => {
    if (!preset.horarios) {
      return preset.horario_entrada && preset.horario_saida
        ? `${preset.horario_entrada} - ${preset.horario_saida}`
        : 'Horário não definido';
    }
    const activeDays = WEEK_DAYS_KEYS.filter(d => preset.horarios?.[d]?.ativo);
    if (activeDays.length === 0) return 'Sem dias ativos';
    const first = preset.horarios[activeDays[0]];
    const allSame = activeDays.every(d => preset.horarios?.[d]?.entrada === first?.entrada && preset.horarios?.[d]?.saida === first?.saida);
    return allSame && first?.entrada && first?.saida ? `${first.entrada} - ${first.saida}` : 'Varia por dia';
  };

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick' || reason === 'escapeKeyDown') return; handleClose(); }}
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
        },
      }}
      sx={{ '& .MuiDialog-container': { background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', pb: 2, fontWeight: 600 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }} component="span">
          <PersonIcon sx={{ color: 'rgba(255, 255, 255, 0.9)' }} />
          <Box component="span">{employee ? 'Editar Funcionário' : 'Cadastrar Funcionário'}</Box>
        </Box>
        <IconButton onClick={handleClose} disabled={loading} sx={{ color: 'rgba(255, 255, 255, 0.7)', '&:hover': { color: 'white', background: 'rgba(255, 255, 255, 0.1)' } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Photo */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Avatar src={photoPreview || undefined} sx={{ width: 120, height: 120, background: 'rgba(255, 255, 255, 0.1)' }}>
                {!photoPreview && <PersonIcon sx={{ fontSize: 60, color: 'rgba(255, 255, 255, 0.5)' }} />}
              </Avatar>
              <input accept="image/*" style={{ display: 'none' }} id="photo-upload" type="file" onChange={handlePhotoChange} disabled={loading} />
              <label htmlFor="photo-upload">
                <Button variant="outlined" component="span" startIcon={<PhotoCameraIcon />} disabled={loading} sx={{ borderColor: 'rgba(255, 255, 255, 0.5)', color: 'rgba(255, 255, 255, 0.8)', '&:hover': { borderColor: 'rgba(255, 255, 255, 0.8)', background: 'rgba(255, 255, 255, 0.05)' } }}>
                  {photo ? 'Alterar Foto' : 'Adicionar Foto'}
                </Button>
              </label>
              {errors.photo && <Typography variant="caption" sx={{ color: '#ef4444' }}>{errors.photo}</Typography>}
            </Box>

            {/* Nome */}
            <TextField fullWidth label="Nome Completo" name="nome" value={formData.nome} onChange={handleChange} error={!!errors.nome} helperText={errors.nome} disabled={loading} variant="outlined" sx={inputSx} />

            {/* Cargo */}
            <Autocomplete
              freeSolo
              options={allCargos}
              value={formData.cargo}
              onChange={handleCargoChange}
              onInputChange={(_, v) => setFormData(prev => ({ ...prev, cargo: v }))}
              disabled={loading}
              renderInput={(params) => (
                <TextField {...params} label="Cargo" error={!!errors.cargo} helperText={errors.cargo || 'Selecione ou digite o cargo'} variant="outlined" fullWidth sx={{ ...inputSx, '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255, 255, 255, 0.7)' } }} />
              )}
              ListboxProps={{ sx: { background: 'rgba(15, 23, 42, 0.95)', color: 'white', '& .MuiAutocomplete-option': { '&.Mui-focused': { backgroundColor: 'rgba(59, 130, 246, 0.35)' } } } }}
            />

            {/* Password */}
            <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                Acesso ao App Mobile (Opcional)
              </Typography>
              <TextField
                fullWidth
                label={employee ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha'}
                name="senha"
                type={showPassword ? 'text' : 'password'}
                value={formData.senha}
                onChange={handleChange}
                error={!!errors.senha}
                helperText={errors.senha || (employee ? 'Preencha apenas se quiser redefinir. Mínimo 6 caracteres.' : 'Mínimo 6 caracteres. Deixe em branco para não dar acesso ao app.')}
                disabled={loading}
                variant="outlined"
                autoComplete="new-password"
                InputProps={{ endAdornment: formData.senha && (<InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment>) }}
                sx={inputSx}
              />
              {formData.senha && (
                <TextField
                  fullWidth
                  label="Confirmar Senha"
                  name="confirmarSenha"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmarSenha}
                  onChange={handleChange}
                  error={!!errors.confirmarSenha}
                  helperText={errors.confirmarSenha}
                  disabled={loading}
                  variant="outlined"
                  autoComplete="new-password"
                  InputProps={{ endAdornment: formData.confirmarSenha && (<InputAdornment position="end"><IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment>) }}
                  sx={{ mt: 2, ...inputSx }}
                />
              )}
            </Box>

            {/* Horários */}
            <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                Horários de Trabalho
              </Typography>

              {/* Toggle Fixo / Variável */}
              <Box sx={{ mb: 3 }}>
                <ToggleButtonGroup value={tipoHorario} exclusive onChange={handleTipoHorarioChange} disabled={loading} fullWidth
                  sx={{ '& .MuiToggleButton-root': { color: 'rgba(255, 255, 255, 0.7)', borderColor: 'rgba(255, 255, 255, 0.3)', py: 1.5, '&.Mui-selected': { background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', borderColor: '#3b82f6', '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' } }, '&:hover': { background: 'rgba(255, 255, 255, 0.05)' } } }}
                >
                  <ToggleButton value="fixo"><ScheduleIcon sx={{ mr: 1 }} />Horário Fixo</ToggleButton>
                  <ToggleButton value="variavel"><AccessTimeIcon sx={{ mr: 1 }} />Horário Variável</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {tipoHorario === 'fixo' ? (
                <>
                  {/* Preset dropdown */}
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel id="preset-horario-label" sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-focused': { color: '#3b82f6' } }}>
                      Selecionar Horário Pré-definido
                    </InputLabel>
                    <Select
                      labelId="preset-horario-label"
                      value={selectedPreset}
                      label="Selecionar Horário Pré-definido"
                      onChange={(e) => handleHorarioPresetChange(e.target.value)}
                      disabled={loading || loadingHorarios}
                      sx={{ color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' }, '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.7)' } }}
                      MenuProps={{ PaperProps: { sx: { background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)', '& .MuiMenuItem-root': { color: 'white', '&:hover': { background: 'rgba(59, 130, 246, 0.2)' }, '&.Mui-selected': { background: 'rgba(59, 130, 246, 0.3)' } } } } }}
                    >
                      <MenuItem value="">
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
                          — Personalizado (editar dias manualmente) —
                        </Typography>
                      </MenuItem>
                      {horariosPreset.length === 0 ? (
                        <MenuItem disabled>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic', fontSize: 14 }}>
                            Nenhum horário cadastrado em Configurações
                          </Typography>
                        </MenuItem>
                      ) : (
                        horariosPreset.map((preset) => (
                          <MenuItem key={preset.nome} value={preset.nome}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <Typography>{preset.nome}</Typography>
                              <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>{formatPresetSummary(preset)}</Typography>
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>

                  {/* Per-day schedule grid */}
                  {errors.horarios && (
                    <Typography sx={{ color: '#ef4444', fontSize: 12, mb: 1 }}>{errors.horarios}</Typography>
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {WEEK_DAYS_WITH_LABELS.map(({ key: dayKey, label }) => {
                      const dayData = horariosPorDia[dayKey];
                      return (
                        <Box
                          key={dayKey}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1.6fr 1fr 1fr',
                            gap: 1.5,
                            alignItems: 'center',
                            p: 1,
                            borderRadius: '8px',
                            background: dayData?.ativo ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            border: `1px solid ${dayData?.ativo ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={dayData?.ativo || false}
                                onChange={(e) => handleDayToggle(dayKey, e.target.checked)}
                                disabled={loading}
                                size="small"
                                sx={{ color: 'rgba(255, 255, 255, 0.5)', '&.Mui-checked': { color: '#3b82f6' }, py: 0 }}
                              />
                            }
                            label={label}
                            sx={{ m: 0, '& .MuiFormControlLabel-label': { color: dayData?.ativo ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: dayData?.ativo ? 500 : 400 } }}
                          />
                          <TextField
                            type="time"
                            label="Entrada"
                            size="small"
                            value={dayData?.entrada || ''}
                            onChange={(e) => handleDayTimeChange(dayKey, 'entrada', e.target.value)}
                            disabled={!dayData?.ativo || loading}
                            InputLabelProps={{ shrink: true }}
                            sx={timeInputSx}
                          />
                          <TextField
                            type="time"
                            label="Saída"
                            size="small"
                            value={dayData?.saida || ''}
                            onChange={(e) => handleDayTimeChange(dayKey, 'saida', e.target.value)}
                            disabled={!dayData?.ativo || loading}
                            InputLabelProps={{ shrink: true }}
                            sx={timeInputSx}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </>
              ) : (
                <Box sx={{ p: 3, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)', textAlign: 'center' }}>
                  <AccessTimeIcon sx={{ fontSize: 40, color: '#60a5fa', mb: 1 }} />
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Horário Variável</Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, mt: 1 }}>
                    O funcionário não terá horário fixo definido. Os registros serão armazenados sem cálculo de atrasos ou faltas.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Intervalo padrão — apenas para horário fixo */}
            {tipoHorario === 'fixo' && (
              <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                  Intervalo Padrão (Almoço)
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, mb: 2 }}>
                  Minutos descontados da jornada como intervalo. Use <strong>0</strong> para funcionários sem intervalo (ex: meio período).
                  O intervalo é flexível — o funcionário pode sair para almoçar em qualquer horário.
                </Typography>
                <TextField
                  fullWidth
                  label="Intervalo padrão (minutos)"
                  value={intervaloPadrao}
                  onChange={(e) => setIntervaloPadrao(e.target.value)}
                  type="number"
                  disabled={loading}
                  variant="outlined"
                  inputProps={{ min: 0, max: 480 }}
                  helperText="Ex: 0 (sem intervalo) · 60 (1h almoço) · 90 (1h30 almoço)"
                  sx={inputSx}
                />
              </Box>
            )}


          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button onClick={handleClose} disabled={loading} sx={{ color: 'rgba(255, 255, 255, 0.7)', '&:hover': { background: 'rgba(255, 255, 255, 0.05)', color: 'white' } }}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonIcon />}
            sx={{ background: '#2563eb', color: 'white', fontWeight: 600, px: 3, '&:hover': { background: '#1d4ed8' }, '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' } }}
          >
            {loading ? 'Salvando...' : employee ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EmployeeForm;
