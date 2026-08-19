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
  Schedule as ScheduleIcon,
  AccessTime as AccessTimeIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  VpnKey as VpnKeyIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { DiaSemana, Employee, HorarioDiaConfig, HorarioPreset, WeeklyScheduleMap } from '../types';
import { config } from '../config';
import { apiService } from '../services/api';

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

const dateInputSx = {
  ...inputSx,
  '& .MuiInputBase-input': { color: 'white' },
  '& input[type="date"]::-webkit-calendar-picker-indicator': {
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
  /** Disparado ao confirmar "Desativar" dentro do modal — o dialog de confirmação
   *  em si vive em EmployeesPage (reaproveitado), este form só pede pra abrir. */
  onRequestDeactivate?: (employee: Employee) => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  open,
  onClose,
  onSubmit,
  employee,
  loading = false,
  existingCargos = [],
  companySettings,
  onRequestDeactivate,
}) => {
  const [formData, setFormData] = useState({
    nome: employee?.nome || '',
    cargo: employee?.cargo || '',
  });
  // Opcional: quando definida, cálculos de horas/faltas só contam a partir
  // dela. Funcionários sem essa data continuam calculados como sempre foram.
  const [dataAdmissao, setDataAdmissao] = useState<string>(employee?.data_admissao || '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(employee?.foto_url || null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [horariosPreset, setHorariosPreset] = useState<HorarioPreset[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [nomeHorario, setNomeHorario] = useState('');
  // Acesso ao app mobile: senha temporária só existe em memória, enquanto o
  // modal está aberto — nunca persiste em texto puro (ver LGPD/senha_original
  // já removido deste projeto antes). Fechar o modal ou recarregar a página
  // apaga; o RH gera de novo se esquecer de copiar.
  const [tempCredentials, setTempCredentials] = useState<{ login: string; senha_temporaria: string } | null>(null);
  const [generatingSenha, setGeneratingSenha] = useState(false);
  const [senhaError, setSenhaError] = useState('');
  const [copiedField, setCopiedField] = useState<'login' | 'senha' | null>(null);
  const [intervaloPersonalizado, setIntervaloPersonalizado] = useState<boolean>(employee?.intervalo_personalizado || false);
  const [intervaloEmp, setIntervaloEmp] = useState<string>(employee?.intervalo_emp?.toString() || '');
  // Intervalo padrão (minutos). 0 é válido. Default 60 para novos com horário fixo.
  const [intervaloPadrao, setIntervaloPadrao] = useState<string>(
    employee?.intervalo_padrao_minutos !== undefined && employee?.intervalo_padrao_minutos !== null
      ? String(employee.intervalo_padrao_minutos)
      : (employee ? '' : '60')
  );
  // Configuração individual de jornada
  const [intervaloModoAutomatico, setIntervaloModoAutomatico] = useState<boolean>(
    employee?.intervalo_automatico !== undefined && employee?.intervalo_automatico !== null
      ? employee.intervalo_automatico
      : !!companySettings?.intervalo_automatico
  );
  const [usarEmpresaEntradaAntecipada, setUsarEmpresaEntradaAntecipada] = useState<boolean>(
    employee ? (employee.early_entry_overtime === undefined || employee.early_entry_overtime === null) : true
  );
  const [entradaAntecipadaExtra, setEntradaAntecipadaExtra] = useState<boolean>(
    employee?.early_entry_overtime === true
  );
  const [tipoHorario, setTipoHorario] = useState<'fixo' | 'variavel'>(
    employee?.horario_entrada ? 'fixo' : 'variavel'
  );
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [horariosPorDia, setHorariosPorDia] = useState<Record<DiaSemana, HorarioDiaConfig>>(buildDefaultSchedule());
  // Snapshot do horário como veio do funcionário, para detectar se foi alterado nesta edição.
  const [horarioOriginal, setHorarioOriginal] = useState<{ tipo: 'fixo' | 'variavel'; horarios: Record<DiaSemana, HorarioDiaConfig> } | null>(null);
  const [vigenciaDialogOpen, setVigenciaDialogOpen] = useState(false);
  const [vigenciaModo, setVigenciaModo] = useState<'retroativo' | 'futuro'>('futuro');
  const [vigenciaData, setVigenciaData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

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
    // Senha temporária continua visível ao reabrir o modal enquanto o funcionário
    // não tiver trocado (must_change_password ainda true) — persistida no backend
    // até lá (senha_temporaria_plain), decisão consciente do usuário.
    setTempCredentials(
      employee?.must_change_password && employee?.senha_temporaria_plain
        ? { login: employee.id, senha_temporaria: employee.senha_temporaria_plain }
        : null
    );
    setSenhaError('');
    if (employee) {
      setFormData({ nome: employee.nome, cargo: employee.cargo });
      setDataAdmissao(employee.data_admissao || '');
      setPhotoPreview(employee.foto_url);
      setIntervaloPersonalizado(!!employee.intervalo_personalizado);
      setIntervaloEmp(employee.intervalo_emp ? employee.intervalo_emp.toString() : '');
      setIntervaloPadrao(
        employee.intervalo_padrao_minutos !== undefined && employee.intervalo_padrao_minutos !== null
          ? String(employee.intervalo_padrao_minutos)
          : (employee.intervalo_emp ? String(employee.intervalo_emp) : '60')
      );
      setIntervaloModoAutomatico(
        employee.intervalo_automatico !== undefined && employee.intervalo_automatico !== null
          ? employee.intervalo_automatico
          : !!companySettings?.intervalo_automatico
      );
      setUsarEmpresaEntradaAntecipada(employee.early_entry_overtime === undefined || employee.early_entry_overtime === null);
      setEntradaAntecipadaExtra(employee.early_entry_overtime === true);
      setTipoHorario(employee.horario_entrada ? 'fixo' : 'variavel');

      const predHora = employee.pred_hora || '';
      setSelectedPreset(predHora);
      setNomeHorario(predHora);

      let horariosCarregados: Record<DiaSemana, HorarioDiaConfig>;
      if (employee.custom_schedule && Object.keys(employee.custom_schedule).length > 0) {
        horariosCarregados = buildScheduleFromCustom(employee.custom_schedule);
      } else if (employee.horario_entrada && employee.horario_saida) {
        horariosCarregados = buildScheduleFromLegacy(employee.horario_entrada, employee.horario_saida);
      } else {
        horariosCarregados = buildDefaultSchedule();
      }
      setHorariosPorDia(horariosCarregados);
      setHorarioOriginal({
        tipo: employee.horario_entrada ? 'fixo' : 'variavel',
        horarios: horariosCarregados,
      });
    } else {
      setHorarioOriginal(null);
      setFormData({ nome: '', cargo: '' });
      setDataAdmissao('');
      setPhoto(null);
      setPhotoPreview(null);
      setNomeHorario('');
      setTipoHorario('variavel');
      setSelectedPreset('');
      setHorariosPorDia(buildDefaultSchedule());
      setIntervaloPersonalizado(false);
      setIntervaloEmp('');
      setIntervaloPadrao('60');
      setIntervaloModoAutomatico(!!companySettings?.intervalo_automatico);
      setUsarEmpresaEntradaAntecipada(true);
      setEntradaAntecipadaExtra(false);
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

  const handleCopyMondayToWeekdays = () => {
    const monday = horariosPorDia.segunda;
    if (!monday?.entrada || !monday?.saida) return;
    setHorariosPorDia(prev => {
      const next = { ...prev };
      (['terca', 'quarta', 'quinta', 'sexta'] as DiaSemana[]).forEach((d) => {
        next[d] = { entrada: monday.entrada, saida: monday.saida, ativo: true };
      });
      return next;
    });
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
    // Vazio é válido (opcional) — na edição, enviar vazio remove a data já
    // cadastrada. No cadastro, o backend simplesmente ignora se vazio.
    formDataToSend.append('data_admissao', dataAdmissao);

    // Login/id são gerados pelo backend (nome.sobrenome, com dedup) — não enviar
    // nada daqui, tanto na criação quanto na edição.
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

      // Intervalo padrão em minutos (0 é válido = sem intervalo).
      const ipNum = intervaloPadrao.trim() === '' ? 60 : Math.max(0, parseInt(intervaloPadrao) || 0);
      formDataToSend.append('intervalo_padrao_minutos', String(ipNum));

      // Modo do intervalo: manual (exige registro de saída/volta) ou automático (desconta sozinho).
      formDataToSend.append('intervalo_automatico', intervaloModoAutomatico ? 'true' : 'false');
    }

    // Configuração individual de jornada: entrada antecipada como hora extra.
    // "Utilizar configuração da empresa" → envia vazio, backend remove o override.
    formDataToSend.append(
      'early_entry_overtime',
      usarEmpresaEntradaAntecipada ? '' : (entradaAntecipadaExtra ? 'true' : 'false')
    );

    // Se está editando um funcionário que já tinha horário fixo e o horário foi
    // alterado, pergunta se a mudança vale para todo o histórico (retroativo)
    // ou só a partir de uma data — para não recalcular dias já trabalhados.
    const horarioFoiAlterado =
      !!employee &&
      horarioOriginal?.tipo === 'fixo' &&
      tipoHorario === 'fixo' &&
      JSON.stringify(horarioOriginal.horarios) !== JSON.stringify(horariosPorDia);

    if (horarioFoiAlterado) {
      setPendingFormData(formDataToSend);
      setVigenciaModo('futuro');
      setVigenciaData(new Date().toISOString().slice(0, 10));
      setVigenciaDialogOpen(true);
      return;
    }

    formDataToSend.append('vigencia_modo', 'retroativo');
    await onSubmit(formDataToSend);
  };

  const handleConfirmVigencia = async () => {
    if (!pendingFormData) return;
    pendingFormData.append('vigencia_modo', vigenciaModo);
    if (vigenciaModo === 'futuro') {
      pendingFormData.append('vigencia_data', vigenciaData);
    }
    setVigenciaDialogOpen(false);
    const dataToSend = pendingFormData;
    setPendingFormData(null);
    await onSubmit(dataToSend);
  };

  const handleClose = () => {
    setFormData({ nome: '', cargo: '' });
    setDataAdmissao('');
    setPhoto(null);
    setPhotoPreview(null);
    setNomeHorario('');
    setTipoHorario('variavel');
    setSelectedPreset('');
    setHorariosPorDia(buildDefaultSchedule());
    setIntervaloPersonalizado(false);
    setIntervaloEmp('');
    setIntervaloModoAutomatico(!!companySettings?.intervalo_automatico);
    setUsarEmpresaEntradaAntecipada(true);
    setEntradaAntecipadaExtra(false);
    setErrors({});
    setTempCredentials(null);
    setSenhaError('');
    onClose();
  };

  const handleCopy = async (field: 'login' | 'senha', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(prev => (prev === field ? null : prev)), 2000);
    } catch {
      // Clipboard indisponível (ex: contexto não-seguro) — falha silenciosa,
      // o valor continua selecionável/copiável manualmente na tela.
    }
  };

  const handleGerarSenhaTemporaria = async () => {
    if (!employee) return;
    setGeneratingSenha(true);
    setSenhaError('');
    try {
      const result = await apiService.redefinirSenhaFuncionario(employee.id);
      setTempCredentials(result);
    } catch (err: any) {
      setSenhaError(err.response?.data?.error || 'Erro ao gerar senha temporária');
    } finally {
      setGeneratingSenha(false);
    }
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
    <>
    <Dialog
      open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick' || reason === 'escapeKeyDown') return; handleClose(); }}
      disableEscapeKeyDown
      maxWidth="lg"
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
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 4, alignItems: 'start' }}>

          {/* ── Coluna esquerda: identidade e acesso ── */}
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

            {/* Data de Admissão */}
            <TextField
              fullWidth
              type="date"
              label="Data de Admissão"
              value={dataAdmissao}
              onChange={(e) => setDataAdmissao(e.target.value)}
              disabled={loading}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              helperText="Opcional. Se preenchida, horas e faltas só passam a contar a partir dela."
              sx={dateInputSx}
            />

            {/* Acesso ao App Mobile */}
            <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                Acesso ao App Mobile
              </Typography>

              {employee ? (
                <>
                  {/* Sempre employee.id, nunca employee.login — login_funcionario autentica
                      pelo id (via GSI id-index). O campo 'login' é resquício de funcionários
                      cadastrados antes da geração nome.sobrenome e pode ter um valor diferente
                      do id real, o que travava o login do funcionário com "ID ou senha inválidos". */}
                  <TextField
                    fullWidth
                    label="Login"
                    value={employee.id}
                    disabled
                    variant="outlined"
                    sx={{
                      ...inputSx,
                      // O texto em si é o <input>, não o wrapper .MuiOutlinedInput-root — o
                      // -webkit-text-fill-color do MUI pro estado disabled tem que ser
                      // sobrescrito no elemento certo, senão fica preto (padrão do MUI).
                      '& .MuiOutlinedInput-input.Mui-disabled': {
                        WebkitTextFillColor: 'rgba(255, 255, 255, 0.85)',
                        color: 'rgba(255, 255, 255, 0.85)',
                      },
                      '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => handleCopy('login', employee.id)}
                            edge="end"
                            sx={{ color: copiedField === 'login' ? '#34d399' : 'rgba(255, 255, 255, 0.7)' }}
                          >
                            {copiedField === 'login' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleGerarSenhaTemporaria}
                    disabled={loading || generatingSenha}
                    startIcon={generatingSenha ? <CircularProgress size={16} color="inherit" /> : <VpnKeyIcon />}
                    sx={{ mt: 2, borderColor: 'rgba(255, 255, 255, 0.3)', color: 'rgba(255, 255, 255, 0.85)', '&:hover': { borderColor: 'rgba(255, 255, 255, 0.5)', background: 'rgba(255, 255, 255, 0.05)' } }}
                  >
                    {generatingSenha ? 'Gerando...' : 'Gerar Senha Temporária'}
                  </Button>
                  {senhaError && <Typography variant="caption" sx={{ color: '#ef4444', display: 'block', mt: 1 }}>{senhaError}</Typography>}

                  {tempCredentials && (
                    <Box sx={{ mt: 2, p: 2, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <Typography variant="caption" sx={{ color: '#6ee7b7', fontWeight: 600, display: 'block', mb: 1 }}>
                        Senha temporária pendente — o funcionário ainda não trocou
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: 'white', fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
                          {tempCredentials.senha_temporaria}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleCopy('senha', tempCredentials.senha_temporaria)}
                          sx={{ color: copiedField === 'senha' ? '#34d399' : 'rgba(255, 255, 255, 0.7)' }}
                        >
                          {copiedField === 'senha' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', mt: 1 }}>
                        Peça pro funcionário trocar essa senha no primeiro acesso ao app.
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13 }}>
                  O login é gerado automaticamente (nome.sobrenome) ao salvar. Depois de cadastrado, reabra aqui pra gerar a senha temporária de acesso.
                </Typography>
              )}
            </Box>

            {/* Desativar funcionário */}
            {employee && employee.ativo !== false && (
              <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  onClick={() => onRequestDeactivate?.(employee)}
                  disabled={loading}
                  startIcon={<BlockIcon />}
                  sx={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171', '&:hover': { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' } }}
                >
                  Desativar Funcionário
                </Button>
              </Box>
            )}
            {employee && employee.ativo === false && (
              <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
                <Typography variant="body2" sx={{ color: '#f87171', fontSize: 13, fontWeight: 600 }}>
                  Funcionário desativado
                </Typography>
              </Box>
            )}

          </Box>

          {/* ── Coluna direita: horários e intervalos ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Horários */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                Horários de Trabalho
              </Typography>

              {/* Toggle Fixo / Variável */}
              <Box sx={{ mb: 3 }}>
                <ToggleButtonGroup value={tipoHorario} exclusive onChange={handleTipoHorarioChange} disabled={loading} fullWidth
                  sx={{ '& .MuiToggleButton-root': { color: 'rgba(255, 255, 255, 0.7)', borderColor: 'rgba(255, 255, 255, 0.3)', py: 1.5, '&.Mui-selected': { background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', borderColor: '#3b82f6', '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' } }, '&:hover': { background: 'rgba(255, 255, 255, 0.05)' } } }}
                >
                  <ToggleButton value="fixo"><ScheduleIcon sx={{ mr: 1 }} />Horário Fixo</ToggleButton>
                  <ToggleButton value="variavel"><AccessTimeIcon sx={{ mr: 1 }} />Horista</ToggleButton>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    {errors.horarios ? (
                      <Typography sx={{ color: '#ef4444', fontSize: 12 }}>{errors.horarios}</Typography>
                    ) : (
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}>
                        Marque os dias que o funcionário trabalha e ajuste o horário de cada um.
                      </Typography>
                    )}
                    <Button
                      size="small"
                      onClick={handleCopyMondayToWeekdays}
                      disabled={loading || !horariosPorDia.segunda?.ativo || !horariosPorDia.segunda?.entrada || !horariosPorDia.segunda?.saida}
                      sx={{
                        textTransform: 'none',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#93c5fd',
                        whiteSpace: 'nowrap',
                        '&:hover': { background: 'rgba(59, 130, 246, 0.1)' },
                        '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)' },
                      }}
                    >
                      Aplicar Segunda a Sexta
                    </Button>
                  </Box>
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
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Horista</Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, mt: 1 }}>
                    O funcionário não terá horário fixo definido. Os registros serão armazenados sem cálculo de atrasos ou faltas.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Configuração Individual de Jornada — apenas para horário fixo */}
            {tipoHorario === 'fixo' && (
              <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 3 }}>
                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                  Configuração Individual de Jornada
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, mb: 2 }}>
                  Sobrepõe a configuração da empresa apenas para este funcionário. Deixe marcado "Utilizar configuração da empresa" para manter o comportamento padrão.
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>

                {/* Intervalo Padrão */}
                <Box sx={{ p: 2, borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, mb: 1 }}>
                    Intervalo Padrão
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, mb: 1.5 }}>
                    Minutos descontados da jornada como intervalo. Use <strong>0</strong> para funcionários sem intervalo (ex: meio período).
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
                    sx={{ ...inputSx, mb: 2 }}
                  />

                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, mb: 1 }}>
                    Modo do Intervalo
                  </Typography>
                  <ToggleButtonGroup
                    value={intervaloModoAutomatico ? 'automatico' : 'manual'}
                    exclusive
                    onChange={(_e, newModo) => { if (newModo !== null) setIntervaloModoAutomatico(newModo === 'automatico'); }}
                    disabled={loading}
                    fullWidth
                    sx={{ mb: 1.5, '& .MuiToggleButton-root': { color: 'rgba(255, 255, 255, 0.7)', borderColor: 'rgba(255, 255, 255, 0.3)', py: 1, fontSize: 13, '&.Mui-selected': { background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', borderColor: '#3b82f6', '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' } }, '&:hover': { background: 'rgba(255, 255, 255, 0.05)' } } }}
                  >
                    <ToggleButton value="manual">Manual</ToggleButton>
                    <ToggleButton value="automatico">Automático</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13 }}>
                    {intervaloModoAutomatico
                      ? 'Automático: o intervalo é descontado sozinho da carga horária, sem exigir que o funcionário registre saída e volta do intervalo.'
                      : 'Manual: exige que o funcionário registre a saída e a volta do intervalo (batidas de almoço).'}
                  </Typography>
                </Box>

                {/* Entrada antecipada como hora extra */}
                <Box sx={{ p: 2, borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, mb: 1 }}>
                    Entrada Antecipada como Hora Extra
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={usarEmpresaEntradaAntecipada}
                        onChange={(e) => setUsarEmpresaEntradaAntecipada(e.target.checked)}
                        disabled={loading}
                        size="small"
                        sx={{ color: 'rgba(255, 255, 255, 0.5)', '&.Mui-checked': { color: '#3b82f6' }, py: 0 }}
                      />
                    }
                    label="Utilizar configuração da empresa"
                    sx={{ m: 0, mb: 1, '& .MuiFormControlLabel-label': { color: 'rgba(255,255,255,0.85)', fontSize: 14 } }}
                  />
                  {!usarEmpresaEntradaAntecipada && (
                    <>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={entradaAntecipadaExtra}
                            onChange={(e) => setEntradaAntecipadaExtra(e.target.checked)}
                            disabled={loading}
                            size="small"
                            sx={{ color: 'rgba(255, 255, 255, 0.5)', '&.Mui-checked': { color: '#3b82f6' }, py: 0 }}
                          />
                        }
                        label="Entrada antecipada conta como hora extra"
                        sx={{ m: 0, '& .MuiFormControlLabel-label': { color: 'rgba(255,255,255,0.85)', fontSize: 14 } }}
                      />
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, mt: 1 }}>
                        Se marcado, todo tempo registrado antes do horário de entrada é contabilizado como hora extra, independente da saída.
                      </Typography>
                    </>
                  )}
                </Box>

                </Box>
                {/* fim grid intervalo / entrada antecipada */}
              </Box>
            )}

          </Box>
          {/* fim coluna direita */}

          </Box>
          {/* fim grid de duas colunas */}
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

    <Dialog
      open={vigenciaDialogOpen}
      onClose={() => setVigenciaDialogOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
    >
      <DialogTitle sx={{ color: 'white', fontWeight: 600 }}>
        O horário deste funcionário foi alterado
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, mb: 2 }}>
          Como o novo horário deve ser aplicado?
        </Typography>

        <Box
          onClick={() => setVigenciaModo('futuro')}
          sx={{
            p: 2, mb: 1.5, borderRadius: '10px', cursor: 'pointer',
            background: vigenciaModo === 'futuro' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${vigenciaModo === 'futuro' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
          }}
        >
          <Typography sx={{ color: 'white', fontWeight: 500, fontSize: 14 }}>
            A partir de uma data específica
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, mt: 0.5 }}>
            Os registros e cálculos anteriores a essa data continuam usando o horário antigo.
          </Typography>
          {vigenciaModo === 'futuro' && (
            <TextField
              type="date"
              size="small"
              value={vigenciaData}
              onChange={(e) => setVigenciaData(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 1.5, ...timeInputSx }}
              fullWidth
            />
          )}
        </Box>

        <Box
          onClick={() => setVigenciaModo('retroativo')}
          sx={{
            p: 2, borderRadius: '10px', cursor: 'pointer',
            background: vigenciaModo === 'retroativo' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${vigenciaModo === 'retroativo' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
          }}
        >
          <Typography sx={{ color: 'white', fontWeight: 500, fontSize: 14 }}>
            Retroativamente (todo o histórico)
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, mt: 0.5 }}>
            Recalcula também os dias já registrados com o novo horário.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={() => setVigenciaDialogOpen(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirmVigencia}
          variant="contained"
          disabled={vigenciaModo === 'futuro' && !vigenciaData}
          sx={{ background: '#2563eb', color: 'white', fontWeight: 600, '&:hover': { background: '#1d4ed8' } }}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default EmployeeForm;
