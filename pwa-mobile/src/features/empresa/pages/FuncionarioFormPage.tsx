import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../../../services/api';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import type { CredenciaisFuncionario } from '../../../types';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type DiaSemana = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

interface DayConfig { ativo: boolean; entrada: string | null; saida: string | null }

const DIAS: Array<{ key: DiaSemana; label: string }> = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca',   label: 'Terça-feira'   },
  { key: 'quarta',  label: 'Quarta-feira'  },
  { key: 'quinta',  label: 'Quinta-feira'  },
  { key: 'sexta',   label: 'Sexta-feira'   },
  { key: 'sabado',  label: 'Sábado'        },
  { key: 'domingo', label: 'Domingo'       },
];

function buildDefaultSchedule(): Record<DiaSemana, DayConfig> {
  return {
    segunda: { ativo: true,  entrada: '08:00', saida: '17:00' },
    terca:   { ativo: true,  entrada: '08:00', saida: '17:00' },
    quarta:  { ativo: true,  entrada: '08:00', saida: '17:00' },
    quinta:  { ativo: true,  entrada: '08:00', saida: '17:00' },
    sexta:   { ativo: true,  entrada: '08:00', saida: '17:00' },
    sabado:  { ativo: false, entrada: null,    saida: null     },
    domingo: { ativo: false, entrada: null,    saida: null     },
  };
}

const STEPS = ['Dados', 'Horário', 'Pronto'];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function FuncionarioFormPage() {
  const navigate = useNavigate();

  // ── Estado do form ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [credenciais, setCredenciais] = useState<CredenciaisFuncionario | null>(null);

  // Step 1 — dados
  const [nome, setNome]               = useState('');
  const [cargo, setCargo]             = useState('');
  const [senha, setSenha]             = useState('');
  const [confirmarSenha, setConfirmar] = useState('');
  const [showSenha, setShowSenha]     = useState(false);
  const [foto, setFoto]               = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // Step 2 — horário (igual ao front)
  const [tipoHorario, setTipoHorario]                     = useState<'fixo' | 'variavel'>('fixo');
  const [horariosPorDia, setHorariosPorDia]               = useState<Record<DiaSemana, DayConfig>>(buildDefaultSchedule());
  const [presets, setPresets]                             = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset]               = useState('');
  const [nomeHorario, setNomeHorario]                     = useState('');
  const [intervaloPersonalizado, setIntervaloPersonalizado] = useState(false);
  const [intervaloEmp, setIntervaloEmp]                   = useState('');

  // ── Câmera ──────────────────────────────────────────────────────────────────
  const nativeCamRef  = useRef<HTMLInputElement>(null);
  const fileRef       = useRef<HTMLInputElement>(null);
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const [liveCam, setLiveCam] = useState(false);

  // Parar stream ao desmontar
  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), []);

  // Carregar presets da empresa (mesmo que o front)
  useEffect(() => {
    apiService.getHorarios().then(setPresets).catch(() => {});
  }, []);

  // ── Helpers de foto ─────────────────────────────────────────────────────────
  const setFotoFile = (file: File) => {
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
    if (errors.foto) setErrors(e => ({ ...e, foto: '' }));
  };

  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFotoFile(f); e.target.value = ''; }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFotoFile(f); e.target.value = ''; }
  };

  const startLiveCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setLiveCam(true);
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream; });
    } catch { alert('Não foi possível acessar a câmera.'); }
  };

  const stopLiveCam = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setLiveCam(false);
  }, []);

  const captureLivePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.translate(c.width, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    c.toBlob(blob => {
      if (!blob) return;
      const f = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      setFotoFile(f);
      stopLiveCam();
    }, 'image/jpeg', 0.92);
  };

  // ── Helpers de horário ──────────────────────────────────────────────────────
  const toggleDay = (key: DiaSemana, ativo: boolean) => {
    setHorariosPorDia(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        ativo,
        entrada: ativo ? (prev[key].entrada || '08:00') : null,
        saida:   ativo ? (prev[key].saida   || '17:00') : null,
      },
    }));
  };

  const setDayTime = (key: DiaSemana, field: 'entrada' | 'saida', val: string) => {
    setHorariosPorDia(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  };

  const applyPreset = (presetNome: string) => {
    setSelectedPreset(presetNome);
    if (!presetNome) { setNomeHorario(''); return; }
    const preset = presets.find((p: any) => p.nome === presetNome);
    if (!preset) { setNomeHorario(presetNome); return; }
    setNomeHorario(preset.nome);
    if (preset.horarios) {
      // Preset tem grade por dia
      const updated = buildDefaultSchedule();
      Object.entries(preset.horarios as Record<string, any>).forEach(([dia, cfg]: [string, any]) => {
        if (dia in updated && cfg) {
          (updated as any)[dia] = {
            ativo:   cfg.ativo !== false,
            entrada: cfg.entrada || null,
            saida:   cfg.saida   || null,
          };
        }
      });
      setHorariosPorDia(updated);
    } else if (preset.horario_entrada && preset.horario_saida) {
      // Preset legado (entrada/saída iguais para todos os dias úteis)
      const updated = buildDefaultSchedule();
      (['segunda','terca','quarta','quinta','sexta'] as DiaSemana[]).forEach(d => {
        updated[d] = { ativo: true, entrada: preset.horario_entrada, saida: preset.horario_saida };
      });
      setHorariosPorDia(updated);
    }
  };

  // ── Validação ────────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!nome.trim())    e.nome  = 'Nome é obrigatório';
    if (!cargo.trim())   e.cargo = 'Cargo é obrigatório';
    if (!foto)           e.foto  = 'Foto é obrigatória';
    if (senha.trim()) {
      if (senha.length < 6) e.senha = 'Mínimo 6 caracteres';
      if (senha !== confirmarSenha) e.confirmarSenha = 'As senhas não coincidem';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (tipoHorario === 'fixo') {
      const hasActive = DIAS.some(d => horariosPorDia[d.key].ativo);
      if (!hasActive) e.horarios = 'Selecione ao menos um dia de trabalho';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setStep(s => s + 1);
  };
  const prev = () => setStep(s => s - 1);

  // ── Submit (mesmo payload que o front) ───────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const fd = new FormData();

      // Dados básicos
      fd.append('nome',  nome.trim());
      fd.append('cargo', cargo.trim());

      // login/id gerado igual ao front
      const firstName = nome.trim().split(' ')[0]
        .toLowerCase().normalize('NFD').replace(/[^a-z0-9_]/g, '');
      const login = `${firstName}_${Math.floor(1000 + Math.random() * 9000)}`;
      fd.append('login', login);
      fd.append('id',    login);

      if (senha.trim()) fd.append('senha', senha.trim());
      if (foto) fd.append('foto', foto, 'photo.jpg');

      // Intervalo
      fd.append('intervalo_personalizado', intervaloPersonalizado ? 'true' : 'false');
      if (intervaloPersonalizado && intervaloEmp)
        fd.append('intervalo_emp', intervaloEmp);

      // Horário (mesmo formato que o front)
      fd.append('tipo_horario', tipoHorario);

      if (tipoHorario === 'fixo') {
        fd.append('horarios_json', JSON.stringify(horariosPorDia));
        if (nomeHorario) fd.append('nome_horario', nomeHorario);

        // Primeiro dia ativo → horario_entrada / horario_saida
        const firstActive = DIAS.find(d => horariosPorDia[d.key].ativo);
        if (firstActive) {
          const cfg = horariosPorDia[firstActive.key];
          if (cfg.entrada) fd.append('horario_entrada', cfg.entrada);
          if (cfg.saida)   fd.append('horario_saida',   cfg.saida);
        }
      }

      const res = await apiService.createEmployee(fd);
      const loginId = (res as any).id || (res as any).funcionario?.id || login;
      const senhaTmp = senha.trim() || '(gerada pelo sistema)';
      setCredenciais({ login: loginId, senha_temporaria: senhaTmp });
      setStep(2);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao cadastrar funcionário.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { stopLiveCam(); navigate('/empresa'); }}
            className="text-slate-400 hover:text-slate-200 p-1 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-slate-50">Cadastrar Funcionário</h1>
        </div>

        {/* Indicador de steps */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 ${i < step ? 'text-emerald-400' : i === step ? 'text-blue-400' : 'text-slate-600'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all
                  ${i < step  ? 'bg-emerald-500/20 border-emerald-500/40'
                  : i === step ? 'bg-blue-500/20 border-blue-500/40'
                  : 'bg-slate-800 border-slate-700'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-xs hidden sm:block">{s}</span>
              </div>
              {i < STEPS.length - 1 &&
                <div className={`flex-1 h-px ${i < step ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-8">
        <AnimatePresence mode="wait">

          {/* ── Step 0: Dados + Foto + Senha ──────────────────────────── */}
          {step === 0 && (
            <motion.div key="s0"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Foto */}
              <div className="flex flex-col items-center gap-3">
                {/* Preview */}
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Foto"
                    className="w-32 h-32 rounded-full object-cover border-4 border-blue-500/40 shadow-xl" />
                ) : (
                  <div className={`w-32 h-32 rounded-full bg-slate-800 border-2 flex items-center justify-center
                    ${errors.foto ? 'border-red-500' : 'border-slate-700'}`}>
                    <svg className="w-14 h-14 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}

                {errors.foto && <p className="text-red-400 text-xs">{errors.foto}</p>}

                {/* Câmera ao vivo ativa */}
                {liveCam ? (
                  <div className="w-full rounded-2xl overflow-hidden bg-black relative">
                    <video ref={videoRef} autoPlay playsInline muted
                      className="w-full rounded-2xl" style={{ transform: 'scaleX(-1)' }} />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                      <button onClick={captureLivePhoto}
                        className="bg-white text-slate-900 font-bold px-5 py-2.5 rounded-2xl shadow-xl text-sm">
                        📸 Capturar
                      </button>
                      <button onClick={stopLiveCam}
                        className="bg-slate-800/80 text-slate-300 px-4 py-2.5 rounded-2xl text-sm">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap justify-center">
                    {/* Câmera nativa — recomendado para tablet */}
                    <button onClick={() => nativeCamRef.current?.click()}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      {fotoPreview ? 'Tirar outra foto' : 'Tirar foto *'}
                    </button>
                    {/* Câmera stream */}
                    <button onClick={startLiveCam}
                      className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2.5 rounded-xl text-sm transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                      Câmera ao vivo
                    </button>
                    {/* Galeria */}
                    <button onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2.5 rounded-xl text-sm transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Galeria
                    </button>
                  </div>
                )}

                {/* Inputs ocultos */}
                <input ref={nativeCamRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleNativeCapture} />
                <input ref={fileRef}      type="file" accept="image/*"                className="hidden" onChange={handleFileUpload} />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Nome */}
              <Input label="Nome Completo *" value={nome}
                onChange={e => { setNome(e.target.value); if (errors.nome) setErrors(v => ({ ...v, nome: '' })); }}
                error={errors.nome} placeholder="Ex: João da Silva" />

              {/* Cargo */}
              <Input label="Cargo *" value={cargo}
                onChange={e => { setCargo(e.target.value); if (errors.cargo) setErrors(v => ({ ...v, cargo: '' })); }}
                error={errors.cargo} placeholder="Ex: Operador" />

              {/* Senha */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 space-y-3">
                <p className="text-sm font-semibold text-slate-200">Acesso ao App Mobile <span className="text-slate-500 font-normal">(opcional)</span></p>
                <div className="relative">
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={e => { setSenha(e.target.value); setErrors(v => ({ ...v, senha: '' })); }}
                    placeholder="Mínimo 6 caracteres. Deixe em branco para gerar automaticamente."
                    className={`w-full bg-slate-800 text-slate-200 placeholder-slate-600 rounded-xl px-4 py-3 text-sm border focus:outline-none transition-colors pr-10
                      ${errors.senha ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'}`}
                  />
                  {senha && (
                    <button type="button" onClick={() => setShowSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      {showSenha
                        ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      }
                    </button>
                  )}
                </div>
                {errors.senha && <p className="text-red-400 text-xs">{errors.senha}</p>}

                {/* Confirmar senha — só aparece se senha preenchida */}
                {senha.trim().length > 0 && (
                  <input
                    type="password"
                    value={confirmarSenha}
                    onChange={e => { setConfirmar(e.target.value); setErrors(v => ({ ...v, confirmarSenha: '' })); }}
                    placeholder="Confirmar senha"
                    className={`w-full bg-slate-800 text-slate-200 placeholder-slate-600 rounded-xl px-4 py-3 text-sm border focus:outline-none transition-colors
                      ${errors.confirmarSenha ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'}`}
                  />
                )}
                {errors.confirmarSenha && <p className="text-red-400 text-xs">{errors.confirmarSenha}</p>}
              </div>
            </motion.div>
          )}

          {/* ── Step 1: Horário ───────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Toggle Fixo / Variável */}
              <div className="grid grid-cols-2 gap-2">
                {(['fixo', 'variavel'] as const).map(tipo => (
                  <button key={tipo} onClick={() => setTipoHorario(tipo)}
                    className={`py-4 rounded-2xl border text-sm font-semibold transition-all
                      ${tipoHorario === tipo
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                    {tipo === 'fixo' ? '📅 Horário Fixo' : '🕐 Horário Variável'}
                  </button>
                ))}
              </div>

              {tipoHorario === 'variavel' ? (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 text-center">
                  <p className="text-blue-300 font-semibold text-base">Horário Variável</p>
                  <p className="text-slate-400 text-sm mt-2">
                    O funcionário não terá horário fixo. Os registros serão armazenados sem cálculo de atrasos ou faltas.
                  </p>
                </div>
              ) : (
                <>
                  {/* Select de preset */}
                  {presets.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Horário pré-definido <span className="text-slate-500">(opcional)</span>
                      </label>
                      <select
                        value={selectedPreset}
                        onChange={e => applyPreset(e.target.value)}
                        className="w-full bg-slate-800 text-slate-200 rounded-xl px-4 py-3 text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">— Personalizado —</option>
                        {presets.map((p: any) => (
                          <option key={p.nome} value={p.nome}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Grade por dia */}
                  {errors.horarios && <p className="text-red-400 text-xs">{errors.horarios}</p>}
                  <div className="space-y-2">
                    {DIAS.map(({ key, label }) => {
                      const d = horariosPorDia[key];
                      return (
                        <div key={key}
                          className={`rounded-xl border px-4 py-3 transition-all
                            ${d.ativo ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 border-slate-800/50'}`}>
                          <div className="flex items-center gap-3">
                            {/* Toggle dia */}
                            <button onClick={() => toggleDay(key, !d.ativo)}
                              className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-all
                                ${d.ativo ? 'bg-blue-500' : 'bg-slate-700'}`}>
                              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                                ${d.ativo ? 'left-4' : 'left-0.5'}`} />
                            </button>

                            <span className={`text-sm font-medium w-28 flex-shrink-0 ${d.ativo ? 'text-slate-200' : 'text-slate-600'}`}>
                              {label}
                            </span>

                            {d.ativo ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="time" value={d.entrada || '08:00'}
                                  onChange={e => setDayTime(key, 'entrada', e.target.value)}
                                  className="flex-1 bg-slate-800 text-slate-200 rounded-lg px-2 py-1.5 text-sm border border-slate-700 focus:border-blue-500 focus:outline-none" />
                                <span className="text-slate-600 text-xs flex-shrink-0">→</span>
                                <input type="time" value={d.saida || '17:00'}
                                  onChange={e => setDayTime(key, 'saida', e.target.value)}
                                  className="flex-1 bg-slate-800 text-slate-200 rounded-lg px-2 py-1.5 text-sm border border-slate-700 focus:border-blue-500 focus:outline-none" />
                              </div>
                            ) : (
                              <span className="text-slate-600 text-sm">Folga</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Intervalo personalizado */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setIntervaloPersonalizado(v => !v); if (intervaloPersonalizado) setIntervaloEmp(''); }}
                        className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-all ${intervaloPersonalizado ? 'bg-blue-500' : 'bg-slate-700'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${intervaloPersonalizado ? 'left-4' : 'left-0.5'}`} />
                      </button>
                      <div>
                        <p className="text-sm font-medium text-slate-300">Intervalo de almoço personalizado</p>
                        <p className="text-xs text-slate-500">Configure apenas se diferente do padrão da empresa</p>
                      </div>
                    </div>
                    {intervaloPersonalizado && (
                      <div className="mt-3">
                        <input type="number" value={intervaloEmp} min={0}
                          onChange={e => setIntervaloEmp(e.target.value)}
                          placeholder="Duração em minutos (ex: 60)"
                          className="w-full bg-slate-800 text-slate-200 placeholder-slate-600 rounded-xl px-4 py-3 text-sm border border-slate-700 focus:border-blue-500 focus:outline-none" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ── Step 2: Credenciais ───────────────────────────────────── */}
          {step === 2 && credenciais && (
            <motion.div key="s2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">Funcionário Criado!</h2>
                <p className="text-slate-400 mt-1">Compartilhe as credenciais de acesso</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credenciais de Acesso</p>

                {[
                  { label: 'ID do Funcionário (login)', value: credenciais.login },
                  { label: 'Senha',                     value: credenciais.senha_temporaria },
                ].map(item => (
                  <div key={item.label} className="bg-slate-950 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="text-slate-100 font-mono text-base mt-0.5">{item.value}</p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(item.value).catch(() => {})}
                      className="text-slate-500 hover:text-slate-200 p-2 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => navigator.clipboard.writeText(`Login: ${credenciais.login}\nSenha: ${credenciais.senha_temporaria}`).catch(() => {})}
                  className="w-full bg-blue-600/15 hover:bg-blue-600/25 border border-blue-600/30 text-blue-400 rounded-xl py-3 text-sm transition-all">
                  📋 Copiar tudo
                </button>
              </div>

              <p className="text-xs text-center text-slate-500">O funcionário poderá alterar a senha no primeiro acesso.</p>

              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={() => navigate('/empresa')}>← Voltar</Button>
                <Button fullWidth onClick={() => {
                  setStep(0); setNome(''); setCargo(''); setSenha(''); setConfirmar('');
                  setFoto(null); setFotoPreview(null); setCredenciais(null);
                  setTipoHorario('fixo'); setHorariosPorDia(buildDefaultSchedule());
                  setSelectedPreset(''); setNomeHorario('');
                  setIntervaloPersonalizado(false); setIntervaloEmp('');
                }}>+ Novo Cadastro</Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer */}
      {step < 2 && (
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-5 flex gap-3">
          {step > 0 && <Button variant="ghost" onClick={prev} className="flex-1 py-4 text-base">← Anterior</Button>}
          {step === 0 && (
            <Button fullWidth onClick={next} className="py-4 text-base">Próximo →</Button>
          )}
          {step === 1 && (
            <Button onClick={handleSubmit} loading={loading} className="flex-1 py-4 text-base">
              Cadastrar Funcionário
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
