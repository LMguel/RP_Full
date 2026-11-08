import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  LinearProgress,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
  BeachAccess as BeachIcon,
  MedicalServices as MedicalIcon,
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  CalendarMonth as BatchIcon,
  EventAvailable as DeclIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../services/api';
import { Employee, LoteDiaEnvio, LoteResultado } from '../types';
import BatchRecordsPanel, { LoteResultadoView } from './BatchRecordsPanel';

type Mode = 'ponto' | 'lote' | 'declaracao' | 'ferias' | 'atestado';

interface TimeRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    employee_id: string;
    data_hora: string;
    justificativa: string;
  }) => Promise<void>;
  loading?: boolean;
  employees?: Employee[];
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    background: 'rgba(255,255,255,0.05)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.45)' },
    '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.7)' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)', '&.Mui-focused': { color: 'rgba(255,255,255,0.9)' } },
  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.45)' },
  '& input[type="date"]::-webkit-calendar-picker-indicator': { filter: 'invert(1) brightness(0.7)' },
  '& input[type="time"]::-webkit-calendar-picker-indicator': { filter: 'invert(1) brightness(0.7)' },
};

const MODES: { key: Mode; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { key: 'ponto',    label: 'Ponto Manual',   icon: <AccessTimeIcon sx={{ fontSize: 16 }} />, color: '#3b82f6', desc: 'Registrar ponto — tipo calculado automaticamente' },
  { key: 'lote',     label: 'Vários Dias',    icon: <BatchIcon      sx={{ fontSize: 16 }} />, color: '#f97316', desc: 'Lançar o ponto de vários dias de uma vez (ex.: dias sem internet)' },
  { key: 'declaracao', label: 'Declaração', icon: <DeclIcon sx={{ fontSize: 16 }} />, color: '#f59e0b', desc: 'Abonar só algumas horas do dia (ex.: consulta médica) — o resto do dia é trabalhado normalmente' },
  { key: 'ferias',  label: 'Férias / Folga',  icon: <BeachIcon      sx={{ fontSize: 16 }} />, color: '#8b5cf6', desc: 'Marcar período de férias ou folga' },
  { key: 'atestado',label: 'Atestado Médico', icon: <MedicalIcon    sx={{ fontSize: 16 }} />, color: '#14b8a6', desc: 'Lançar atestado com upload do documento' },
];

const TimeRecordForm: React.FC<TimeRecordFormProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  employees: propEmployees = [],
}) => {
  const [mode, setMode] = useState<Mode>('ponto');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Common
  const [employeeId, setEmployeeId] = useState('');
  const [employeeInput, setEmployeeInput] = useState('');
  const [justificativa, setJustificativa] = useState('');

  // Ponto manual
  const [pontoDate, setPontoDate] = useState('');
  const [pontoTime, setPontoTime] = useState('');

  // Declaração de comparecimento
  const [declData, setDeclData] = useState('');
  const [declInicio, setDeclInicio] = useState('');
  const [declFim, setDeclFim] = useState('');
  const [declFile, setDeclFile] = useState<File | null>(null);
  const declFileRef = useRef<HTMLInputElement>(null);

  // Vários dias (lote)
  const [loteDias, setLoteDias] = useState<LoteDiaEnvio[]>([]);
  const [lotePendencias, setLotePendencias] = useState(0);
  const [loteResultado, setLoteResultado] = useState<LoteResultado | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const handleLoteChange = useCallback((dias: LoteDiaEnvio[], pendencias: number) => {
    setLoteDias(dias);
    setLotePendencias(pendencias);
  }, []);

  // Férias
  const [feriasInicio, setFeriasInicio] = useState('');
  const [feriasFim, setFeriasFim] = useState('');

  // Atestado
  const [atestadoData, setAtestadoData] = useState('');
  const [atestadoDias, setAtestadoDias] = useState('1');
  const [atestadoFile, setAtestadoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (propEmployees.length > 0) {
      const ativos = propEmployees.filter(e => e.is_active !== false && e.ativo !== false);
      setEmployees([...ativos].sort((a, b) => a.nome.localeCompare(b.nome)));
    } else {
      setLoadingEmployees(true);
      apiService.getEmployees().then((r: any) => {
        const list: Employee[] = (r.funcionarios || []).filter(
          (e: Employee) => e.is_active !== false && e.ativo !== false
        );
        setEmployees(list.sort((a, b) => a.nome.localeCompare(b.nome)));
      }).catch(() => {}).finally(() => setLoadingEmployees(false));
    }

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const time  = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setPontoDate(today);
    setPontoTime(time);
    setFeriasInicio(today);
    setFeriasFim(today);
    setAtestadoData(today);
    setDeclData(today);
    setDeclInicio('');
    setDeclFim('');
    setDeclFile(null);

    setMode('ponto');
    setEmployeeId('');
    setEmployeeInput('');
    setJustificativa('');
    setAtestadoDias('1');
    setAtestadoFile(null);
    setUploadProgress(null);
    setErrors({});
    setLoteResultado(null);
    setTentouEnviar(false);
  }, [open]);

  const selectedEmployee = employees.find(e => e.id === employeeId) || null;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!employeeId) e.employee = 'Selecione um funcionário';
    if (!justificativa.trim() || justificativa.trim().length < 5) e.just = 'Justificativa mínima de 5 caracteres';

    if (mode === 'ponto') {
      if (!pontoDate || !pontoTime) e.data = 'Data e hora obrigatórias';
      else {
        const dt = new Date(`${pontoDate}T${pontoTime}:00`);
        if (dt > new Date()) e.data = 'Não é possível registrar no futuro';
      }
    }
    if (mode === 'lote') {
      if (loteDias.length === 0) e.lote = 'Marque pelo menos um dia para lançar';
      else if (lotePendencias > 0) e.lote = `Corrija os horários de ${lotePendencias} dia(s) marcado(s) antes de lançar`;
    }
    if (mode === 'declaracao') {
      if (!declData) e.data = 'Data obrigatória';
      if (!declInicio || !declFim) e.decl = 'Informe o horário inicial e final da declaração';
      else if (declFim <= declInicio) e.decl = 'O horário final deve ser depois do inicial';
      if (declFile && declFile.size > 15 * 1024 * 1024) e.arquivo = 'Arquivo excede o limite de 15 MB';
    }
    if (mode === 'ferias') {
      if (!feriasInicio) e.data = 'Data de início obrigatória';
      if (!feriasFim) e.dataFim = 'Data de fim obrigatória';
      if (feriasInicio && feriasFim && feriasFim < feriasInicio) e.dataFim = 'Data de fim deve ser ≥ início';
    }
    if (mode === 'atestado') {
      if (!atestadoData) e.data = 'Data do atestado obrigatória';
      const d = parseInt(atestadoDias, 10);
      if (!d || d < 1) e.dias = 'Número de dias inválido';
      if (!atestadoFile) e.arquivo = 'Faça o upload do atestado';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTentouEnviar(true);
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (mode === 'ponto') {
        await onSubmit({
          employee_id: employeeId,
          data_hora: `${pontoDate} ${pontoTime}:00`,
          justificativa: justificativa.trim(),
        });
      } else if (mode === 'lote') {
        try {
          const resultado = await apiService.registerPontoLote({
            employee_id: employeeId,
            justificativa: justificativa.trim(),
            dias: loteDias,
          });
          setLoteResultado(resultado);
        } catch (err: unknown) {
          const er = err as { response?: { data?: { mensagem?: string; ignorados?: { data: string; motivo: string }[] } } };
          const motivos = er?.response?.data?.ignorados?.map(i => `${i.data.split('-').reverse().join('/')}: ${i.motivo}`).join(' • ');
          const base = er?.response?.data?.mensagem || 'Não foi possível lançar os dias. Tente novamente.';
          setErrors(prev => ({ ...prev, submit: motivos ? `${base}. ${motivos}` : base }));
        }
      } else if (mode === 'declaracao') {
        try {
          const fd = new FormData();
          fd.append('employee_id', employeeId);
          fd.append('data', declData);
          fd.append('hora_inicio', declInicio);
          fd.append('hora_fim', declFim);
          fd.append('justificativa', justificativa.trim());
          if (declFile) fd.append('arquivo', declFile);
          await apiService.registerDeclaracao(fd);
          onClose();
        } catch (err: unknown) {
          const er = err as { response?: { data?: { mensagem?: string } } };
          setErrors(prev => ({ ...prev, submit: er?.response?.data?.mensagem || 'Não foi possível lançar a declaração. Tente novamente.' }));
        }
      } else if (mode === 'ferias') {
        await apiService.registerFerias({
          employee_id: employeeId,
          data_inicio: feriasInicio,
          data_fim: feriasFim,
          justificativa: justificativa.trim(),
        });
        onClose();
      } else if (mode === 'atestado') {
        const fd = new FormData();
        fd.append('employee_id', employeeId);
        fd.append('data_inicio', atestadoData);
        fd.append('dias', atestadoDias);
        fd.append('justificativa', justificativa.trim());
        fd.append('arquivo', atestadoFile!);
        setUploadProgress(0);
        try {
          await apiService.registerAtestado(fd, setUploadProgress);
          setUploadProgress(100);
          onClose();
        } catch (err: unknown) {
          setUploadProgress(null);
          const e = err as { response?: { status?: number; data?: { mensagem?: string } }; code?: string; message?: string };
          const status   = e?.response?.status;
          const backend  = e?.response?.data?.mensagem;
          let msg: string;
          if (status === 413) {
            msg = 'Arquivo excede o limite de 15 MB. Comprima o documento e tente novamente.';
          } else if (status === 400 && backend) {
            msg = backend;
          } else if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
            msg = 'Upload demorou mais que o esperado. Tente novamente com um arquivo menor.';
          } else if (!e?.response) {
            msg = 'Sem conexão. Verifique a internet e tente novamente.';
          } else {
            msg = 'Não foi possível enviar o atestado. Tente novamente em alguns minutos.';
          }
          setErrors(prev => ({ ...prev, submit: msg }));
          return;
        }
      }
    } catch {
      setErrors(prev => ({ ...prev, submit: 'Erro ao salvar. Tente novamente.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = loading || submitting;
  const modeColor = MODES.find(m => m.key === mode)?.color || '#3b82f6';

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick' || reason === 'escapeKeyDown') return; onClose(); }}
      disableEscapeKeyDown
      maxWidth={mode === 'lote' ? 'md' : 'sm'}
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)',
          backdropFilter: 'blur(24px)',
          borderRadius: '20px',
          border: `1px solid ${modeColor}30`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px ${modeColor}15`,
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ p: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
              Registro Manual
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, mt: 0.4 }}>
              {MODES.find(m => m.key === mode)?.desc}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={isLoading} size="small"
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', background: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Mode tabs */}
        <Box sx={{ px: 3, pb: 2, display: 'flex', gap: 1 }}>
          {MODES.map(m => (
            <Box
              key={m.key}
              onClick={() => { setMode(m.key); setErrors({}); }}
              sx={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                py: 1.2, px: 0.5, borderRadius: '10px', cursor: 'pointer',
                background: mode === m.key ? `${m.color}20` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${mode === m.key ? m.color : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.2s ease',
                '&:hover': { background: `${m.color}15`, borderColor: `${m.color}60` },
              }}
            >
              <Box sx={{ color: mode === m.key ? m.color : 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}>
                {m.icon}
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: mode === m.key ? m.color : 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.2, transition: 'color 0.2s' }}>
                {m.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ py: 3, px: 3 }}>
          {mode === 'lote' && loteResultado ? (
            <LoteResultadoView resultado={loteResultado} />
          ) : loadingEmployees ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={32} sx={{ color: modeColor }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

              {/* Employee selector — common */}
              <Autocomplete
                options={employees}
                getOptionLabel={o => o.nome || ''}
                value={selectedEmployee}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                onChange={(_, v) => { setEmployeeId(v?.id || ''); setErrors(p => ({ ...p, employee: '' })); }}
                inputValue={employeeInput}
                onInputChange={(_, v) => { setEmployeeInput(v); if (!v) setEmployeeId(''); }}
                disabled={isLoading}
                renderInput={params => (
                  <TextField {...params} label="Funcionário *" error={!!errors.employee} helperText={errors.employee} sx={fieldSx} />
                )}
                renderOption={(props, opt) => (
                  <li {...props} key={opt.id}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>{opt.nome}</Typography>
                      {opt.cargo && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{opt.cargo}</Typography>}
                    </Box>
                  </li>
                )}
                ListboxProps={{ sx: { background: 'rgba(15,23,42,0.98)', '& .MuiAutocomplete-option.Mui-focused': { bgcolor: 'rgba(59,130,246,0.25)' } } }}
                noOptionsText={<Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Nenhum funcionário encontrado</Typography>}
                sx={{ '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255,255,255,0.5)' } }}
              />

              {/* ── Ponto Manual ─────────────────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {mode === 'lote' && (
                  <motion.div key="lote" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <BatchRecordsPanel
                      employeeId={employeeId}
                      disabled={isLoading}
                      tentouEnviar={tentouEnviar}
                      onChange={handleLoteChange}
                    />
                    {errors.lote && (
                      <Typography sx={{ color: '#f87171', fontSize: 12, mt: 1 }}>{errors.lote}</Typography>
                    )}
                  </motion.div>
                )}
                {mode === 'ponto' && (
                  <motion.div key="ponto" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="Data" type="date" value={pontoDate}
                        onChange={e => { setPontoDate(e.target.value); setErrors(p => ({ ...p, data: '' })); }}
                        error={!!errors.data} helperText={errors.data}
                        InputLabelProps={{ shrink: true }} disabled={isLoading}
                        sx={{ flex: 1, ...fieldSx }}
                      />
                      <TextField
                        label="Hora" type="time" value={pontoTime}
                        onChange={e => { setPontoTime(e.target.value); setErrors(p => ({ ...p, data: '' })); }}
                        error={!!errors.data}
                        InputLabelProps={{ shrink: true }} disabled={isLoading}
                        sx={{ flex: 1, ...fieldSx }}
                      />
                    </Box>
                    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <Typography sx={{ fontSize: 12, color: 'rgba(148,163,184,0.9)' }}>
                        💡 O tipo (entrada/saída) é calculado automaticamente com base nos registros existentes do dia.
                      </Typography>
                    </Box>
                  </motion.div>
                )}

                {/* ── Declaração de comparecimento ─────────────────────────── */}
                {mode === 'declaracao' && (
                  <motion.div key="declaracao" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                      <TextField
                        label="Data" type="date" value={declData}
                        onChange={e => { setDeclData(e.target.value); setErrors(p => ({ ...p, data: '' })); }}
                        error={!!errors.data} helperText={errors.data}
                        InputLabelProps={{ shrink: true }} disabled={isLoading}
                        sx={{ flex: 2, ...fieldSx }}
                      />
                      <TextField
                        label="Das" type="time" value={declInicio}
                        onChange={e => { setDeclInicio(e.target.value); setErrors(p => ({ ...p, decl: '' })); }}
                        error={!!errors.decl}
                        InputLabelProps={{ shrink: true }} disabled={isLoading}
                        sx={{ flex: 1, ...fieldSx }}
                      />
                      <TextField
                        label="Até" type="time" value={declFim}
                        onChange={e => { setDeclFim(e.target.value); setErrors(p => ({ ...p, decl: '' })); }}
                        error={!!errors.decl} helperText={errors.decl}
                        InputLabelProps={{ shrink: true }} disabled={isLoading}
                        sx={{ flex: 1, ...fieldSx }}
                      />
                    </Box>

                    <input
                      ref={declFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden
                      onChange={e => { setDeclFile(e.target.files?.[0] || null); setErrors(p => ({ ...p, arquivo: '' })); }}
                    />
                    <Box
                      onClick={() => !isLoading && declFileRef.current?.click()}
                      sx={{
                        border: `2px dashed ${errors.arquivo ? '#ef4444' : declFile ? '#f59e0b' : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: 2, p: 1.8, textAlign: 'center', cursor: isLoading ? 'not-allowed' : 'pointer',
                        background: declFile ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                        '&:hover': isLoading ? {} : { borderColor: '#f59e0b' },
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: declFile ? '#f59e0b' : 'rgba(255,255,255,0.55)' }}>
                        {declFile ? declFile.name : 'Anexar a declaração (opcional) — PDF, JPG ou PNG'}
                      </Typography>
                    </Box>
                    {errors.arquivo && <Typography sx={{ color: '#ef4444', fontSize: 11, mt: 0.5 }}>{errors.arquivo}</Typography>}

                    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                      <Typography sx={{ fontSize: 12, color: 'rgba(148,163,184,0.9)' }}>
                        Só o período informado é abonado. O funcionário continua batendo o ponto normalmente no restante do dia, e a declaração aparece separada do atestado no espelho.
                      </Typography>
                    </Box>
                  </motion.div>
                )}

                {/* ── Férias / Folga ────────────────────────────────────────── */}
                {mode === 'ferias' && (
                  <motion.div key="ferias" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="Data de Início" type="date" value={feriasInicio}
                        onChange={e => { setFeriasInicio(e.target.value); setErrors(p => ({ ...p, data: '' })); }}
                        error={!!errors.data} helperText={errors.data}
                        InputLabelProps={{ shrink: true }} disabled={isLoading}
                        sx={{ flex: 1, ...fieldSx }}
                      />
                      <TextField
                        label="Data de Fim" type="date" value={feriasFim}
                        onChange={e => { setFeriasFim(e.target.value); setErrors(p => ({ ...p, dataFim: '' })); }}
                        error={!!errors.dataFim} helperText={errors.dataFim}
                        InputLabelProps={{ shrink: true }} disabled={isLoading}
                        inputProps={{ min: feriasInicio }}
                        sx={{ flex: 1, ...fieldSx }}
                      />
                    </Box>
                    {feriasInicio && feriasFim && feriasFim >= feriasInicio && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={`${Math.round((new Date(feriasFim).getTime() - new Date(feriasInicio).getTime()) / 86400000) + 1} dia(s)`}
                          size="small"
                          sx={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa', fontWeight: 700, fontSize: 11 }}
                        />
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>marcados como Férias/Folga no espelho</Typography>
                      </Box>
                    )}
                  </motion.div>
                )}

                {/* ── Atestado ─────────────────────────────────────────────── */}
                {mode === 'atestado' && (
                  <motion.div key="atestado" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <TextField
                        label="Data do Atestado" type="date" value={atestadoData}
                        onChange={e => { setAtestadoData(e.target.value); setErrors(p => ({ ...p, data: '' })); }}
                        error={!!errors.data} helperText={errors.data}
                        InputLabelProps={{ shrink: true }} disabled={isLoading}
                        sx={{ flex: 2, ...fieldSx }}
                      />
                      <TextField
                        label="Dias afastamento" type="number" value={atestadoDias}
                        onChange={e => { setAtestadoDias(e.target.value); setErrors(p => ({ ...p, dias: '' })); }}
                        error={!!errors.dias} helperText={errors.dias}
                        inputProps={{ min: 1, max: 365 }}
                        disabled={isLoading}
                        sx={{ flex: 1, ...fieldSx }}
                      />
                    </Box>

                    {/* Formatos e limite */}
                    <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 1.5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                        Formatos aceitos: <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>PDF • PNG • JPG</span>
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                        Máx: <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>15 MB</span>
                      </Typography>
                    </Box>

                    {/* File upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0] || null;
                        if (f) {
                          if (f.size > 15 * 1024 * 1024) {
                            setErrors(p => ({ ...p, arquivo: 'Arquivo excede o limite de 15 MB. Comprima o documento e tente novamente.' }));
                            e.target.value = '';
                            return;
                          }
                          const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
                          if (!allowed.includes(f.type)) {
                            setErrors(p => ({ ...p, arquivo: 'Formato não suportado. Envie PDF, PNG ou JPG.' }));
                            e.target.value = '';
                            return;
                          }
                          if (f.size === 0) {
                            setErrors(p => ({ ...p, arquivo: 'O arquivo está vazio. Selecione outro documento.' }));
                            e.target.value = '';
                            return;
                          }
                        }
                        setAtestadoFile(f);
                        setErrors(p => ({ ...p, arquivo: '' }));
                      }}
                    />
                    <Box
                      onClick={() => !isLoading && fileInputRef.current?.click()}
                      sx={{
                        border: `2px dashed ${errors.arquivo ? '#ef4444' : atestadoFile ? '#14b8a6' : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: 2, p: 2.5, textAlign: 'center',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        background: atestadoFile ? 'rgba(20,184,166,0.06)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.2s ease',
                        '&:hover': isLoading ? {} : { borderColor: '#14b8a6', background: 'rgba(20,184,166,0.06)' },
                      }}
                    >
                      {atestadoFile ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <FileIcon sx={{ color: '#14b8a6', fontSize: 20 }} />
                          <Typography sx={{ color: '#14b8a6', fontSize: 13, fontWeight: 600 }}>{atestadoFile.name}</Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                            ({atestadoFile.size < 1024 * 1024
                              ? `${(atestadoFile.size / 1024).toFixed(0)} KB`
                              : `${(atestadoFile.size / (1024 * 1024)).toFixed(1)} MB`})
                          </Typography>
                        </Box>
                      ) : (
                        <Box>
                          <UploadIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 28, mb: 0.5 }} />
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600 }}>Clique para selecionar o atestado</Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, mt: 0.3 }}>PDF, JPG ou PNG — até 15 MB</Typography>
                        </Box>
                      )}
                    </Box>
                    {errors.arquivo && (
                      <Typography sx={{ color: '#ef4444', fontSize: 11, mt: 0.5 }}>{errors.arquivo}</Typography>
                    )}

                    {/* Progress bar durante upload */}
                    {uploadProgress !== null && (
                      <Box sx={{ mt: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Enviando arquivo...</Typography>
                          <Typography sx={{ fontSize: 11, color: '#14b8a6', fontWeight: 700 }}>{uploadProgress}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={uploadProgress}
                          sx={{
                            borderRadius: 4,
                            height: 6,
                            background: 'rgba(255,255,255,0.08)',
                            '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #14b8a6, #06b6d4)', borderRadius: 4 },
                          }}
                        />
                      </Box>
                    )}

                    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
                      <Typography sx={{ fontSize: 12, color: 'rgba(148,163,184,0.9)' }}>
                        Os dias de atestado contam como horas trabalhadas no espelho de ponto.
                        O arquivo fica salvo e pode ser visualizado a qualquer momento.
                      </Typography>
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Justificativa — common */}
              <TextField
                label="Justificativa *"
                placeholder={
                  mode === 'declaracao' ? 'Ex: Consulta médica — declaração de comparecimento'
                  : mode === 'lote' ? 'Ex: Sistema sem internet de 28/10 a 04/11 — horários informados pelo funcionário'
                  : mode === 'ferias' ? 'Ex: Férias anuais — período acordado em contrato'
                  : mode === 'atestado' ? 'Ex: Atestado médico — gripe com febre'
                  : 'Informe o motivo do registro manual'
                }
                value={justificativa}
                onChange={e => { setJustificativa(e.target.value); setErrors(p => ({ ...p, just: '' })); }}
                error={!!errors.just}
                helperText={errors.just}
                multiline rows={2}
                disabled={isLoading}
                sx={fieldSx}
              />

              {errors.submit && (
                <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <Typography sx={{ color: '#f87171', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>{errors.submit}</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, borderTop: '1px solid rgba(255,255,255,0.07)', gap: 1 }}>
          <Button onClick={onClose} disabled={isLoading}
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', background: 'rgba(255,255,255,0.06)' } }}>
            {mode === 'lote' && loteResultado ? 'Concluir' : 'Cancelar'}
          </Button>
          {!(mode === 'lote' && loteResultado) && (
          <Button type="submit" variant="contained" disabled={isLoading || loadingEmployees}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : MODES.find(m => m.key === mode)?.icon}
            sx={{
              px: 3, fontWeight: 700,
              background: `linear-gradient(135deg, ${modeColor}, ${modeColor}cc)`,
              boxShadow: `0 4px 16px ${modeColor}40`,
              '&:hover': { background: modeColor, boxShadow: `0 6px 20px ${modeColor}60` },
              '&:disabled': { background: 'rgba(255,255,255,0.1)', boxShadow: 'none' },
            }}>
            {isLoading && mode === 'atestado'
              ? uploadProgress !== null ? `Enviando... ${uploadProgress}%` : 'Enviando...'
              : isLoading ? 'Salvando...'
              : mode === 'ponto' ? 'Registrar Ponto'
              : mode === 'declaracao' ? 'Lançar Declaração'
              : mode === 'lote' ? (loteDias.length ? `Lançar ${loteDias.length} dia(s)` : 'Lançar dias')
              : mode === 'ferias' ? 'Registrar Férias/Folga'
              : 'Enviar Atestado'}
          </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TimeRecordForm;
