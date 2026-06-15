import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import { useAuth } from '../auth/AuthContext';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useKioskWatchdog } from '../../hooks/useKioskWatchdog';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { pingBackend } from '../../hooks/useBackendStatus';
import { renewSession } from '../../hooks/useSessionTimeout';
import { getSaoPauloTimeString } from '../../utils/time';
import KioskClock from './components/KioskClock';
import KioskOfflineMode from './components/KioskOfflineMode';
import type { RecognitionResult, RegisterPointResult } from '../../types';
import { kioskLog } from '../../services/kioskLogger';
import { kioskUpdateCoordinator } from '../../services/kioskUpdateCoordinator';

const CAMERA_STREAM_MAX_MS = 30 * 60 * 1000; // reinicia stream após 30min

type ConfirmData = {
  id: string;
  companyId: string;
  nome: string;
  cargo?: string;
  tipo: string;
  tipoLabel: string;
};

type SuccessData = { nome: string; tipo: string; tipo_label: string; horario: string };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function KioskPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Ref tracks the actual MediaStream so stopCamera always sees the current stream
  // regardless of React's async state updates (fixes stale closure bug in cleanup).
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraStartTimeRef = useRef(0);           // Unix ms — quando o stream foi iniciado
  const errorCountRef = useRef(0);                // Erros consecutivos — guia a recuperação automática
  const isProcessingRef = useRef(false);          // Stale-closure guard para o coordinator

  const navigate = useNavigate();
  const { user, userType, clearKioskRestore } = useAuth();
  const { isOnline, backendAvailable, pendingCount, syncStatus, refreshPendingCount } = useOfflineSync();

  // Ref for stale-closure guard in handleCapture
  const backendAvailableRef = useRef(backendAvailable);

  const showOfflineMode = !isOnline || !backendAvailable;

  const sessionCompanyId = (userType === 'empresa' && (user as any)?.company_id) || null;

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmData, setConfirmData] = useState<ConfirmData | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [pontoCompleto, setPontoCompleto] = useState<{ nome: string; cargo?: string } | null>(null);
  const [showSuccess, setShowSuccess] = useState<SuccessData | false>(false);
  const [error, setError] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(true);

  // ── Camera helpers ───────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
      cameraStartTimeRef.current = 0;
      kioskLog('CAMERA_STOP');
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStream(null);
  }, []);

  const startCamera = useCallback(async () => {
    if (cameraStreamRef.current) return; // already running
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      cameraStartTimeRef.current = Date.now();
      errorCountRef.current = 0;
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setError('');
      kioskLog('CAMERA_START');
    } catch {
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Fullscreen persistente: re-entra automaticamente se o usuário sair
  useFullscreen({ persistent: true });

  // Impede o display de dormir enquanto o kiosk estiver ativo
  useWakeLock();

  // Reload periódico (4h) para liberar memória e evitar travamentos de tela longa
  useKioskWatchdog({ isProcessing });

  // Kiosk persistence flag — usado para auto-retorno após reload/update
  useEffect(() => {
    localStorage.setItem('@kiosk:active', 'true');
    // Limpa flag de update pendente de sessão anterior (proteção contra travamento)
    localStorage.removeItem('@kiosk:update_pending');
    kioskLog('KIOSK_BOOT');
    // Não limpar @kiosk:active no unmount: sobrevive a reloads.
    // Limpo apenas quando o usuário clicar em "Voltar" explicitamente.
  }, []);

  // Renova a sessão da empresa a cada 6h para evitar logout automático em tablets 24/7
  useEffect(() => {
    renewSession('empresa');
    const id = setInterval(() => {
      if (localStorage.getItem('@kiosk:active') === 'true') {
        renewSession('empresa');
      }
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Keep stale-closure refs in sync with current state
  useEffect(() => { backendAvailableRef.current = backendAvailable; }, [backendAvailable]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // Camera lifecycle: start/stop based on online mode.
  // stopCamera uses cameraStreamRef so cleanup is never stale.
  useEffect(() => {
    if (showOfflineMode) {
      console.log('[Kiosk] switching to offline mode');
      stopCamera();
    } else {
      startCamera();
    }
    return () => stopCamera();
  }, [showOfflineMode]); // startCamera/stopCamera are stable (useCallback with no deps)

  // Reconnect stream to video element when returning from confirm/success screens
  useEffect(() => {
    if (!confirmData && !pontoCompleto && !showSuccess && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play?.()?.catch(() => {});
    }
  }, [confirmData, pontoCompleto, showSuccess, cameraStream]);

  // Auto-clear pontoCompleto after 4 seconds
  useEffect(() => {
    if (!pontoCompleto) return;
    const t = setTimeout(() => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
      setPontoCompleto(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [pontoCompleto]);

  // Watchdog de câmera: reinicia o stream após 30min para evitar freeze e vazamento de memória
  useEffect(() => {
    const id = setInterval(() => {
      if (
        !cameraStreamRef.current ||
        !cameraStartTimeRef.current ||
        isProcessingRef.current ||
        localStorage.getItem('@kiosk:update_pending') === 'true'
      ) return;

      if (Date.now() - cameraStartTimeRef.current >= CAMERA_STREAM_MAX_MS) {
        kioskLog('CAMERA_RESTART', '30min stream refresh');
        stopCamera();
        setTimeout(() => startCamera(), 500);
      }
    }, 5 * 60 * 1000); // verifica a cada 5min

    return () => clearInterval(id);
  }, [stopCamera, startCamera]);

  // Coordenação com SW update: para câmera antes de aplicar o update
  useEffect(() => {
    const onUpdateReady = async () => {
      // Aguarda reconhecimento em andamento terminar (máx 5s)
      const deadline = Date.now() + 5_000;
      while (isProcessingRef.current && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
      }
      // Para câmera limpa antes do reload
      stopCamera();
      await new Promise(r => setTimeout(r, 500));
      // Sinaliza ao coordinator: câmera parada, pode aplicar o update
      kioskUpdateCoordinator.confirmReady();
    };

    window.addEventListener('kiosk:update-ready', onUpdateReady as EventListener);
    return () => window.removeEventListener('kiosk:update-ready', onUpdateReady as EventListener);
  }, [stopCamera]);

  // ── Torch ────────────────────────────────────────────────────────────────────

  const enableTorch = async (enable = true) => {
    try {
      const track = cameraStreamRef.current?.getVideoTracks()[0];
      if (!track) return false;
      const cap = (track as any).getCapabilities?.();
      if (cap?.torch) {
        await (track as any).applyConstraints?.({ advanced: [{ torch: enable }] });
        return true;
      }
    } catch { /* ignore */ }
    return false;
  };

  // ── Capture / Recognize ──────────────────────────────────────────────────────

  const handleCapture = async () => {
    // Guard: update pendente — não iniciar nova captura
    if (localStorage.getItem('@kiosk:update_pending') === 'true') return;
    // Guard: never call recognizeFace when backend is unavailable
    if (!backendAvailableRef.current) {
      console.log('[Kiosk] recognizeFace blocked: offline mode');
      return;
    }
    if (!videoRef.current || isProcessing) return;
    setIsProcessing(true);
    setError('');

    try {
      let torchOn = false;
      if (flashEnabled) {
        torchOn = await enableTorch(true);
        if (!torchOn) {
          setIsFlashing(true);
          await new Promise(r => setTimeout(r, 180));
        }
      }

      const canvas = canvasRef.current!;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      // Libera memória do canvas imediatamente após o blob ser criado
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!blob) { setError('Erro ao capturar imagem. Tente novamente.'); return; }

      const result: RecognitionResult = await apiService.recognizeFace(blob);

      await enableTorch(false).catch(() => {});
      setIsFlashing(false);

      if (result.reconhecido) {
        errorCountRef.current = 0; // reconhecimento bem-sucedido — reseta contador
        if (!result.funcionario?.funcionario_id) { setError('Erro: ID do funcionário não encontrado.'); return; }

        const matchedCompany = result.funcionario?.company_id;
        if (!sessionCompanyId) { setError('Sessão inválida. Faça login novamente.'); return; }
        if (matchedCompany && matchedCompany !== sessionCompanyId) { setError('Funcionário não pertence a esta empresa.'); return; }

        const blobUrl = URL.createObjectURL(blob);
        setCapturedUrl(blobUrl);

        if (result.ponto_completo) {
          setPontoCompleto({ nome: result.funcionario.nome, cargo: result.funcionario.cargo });
        } else {
          setConfirmData({
            id: result.funcionario.funcionario_id,
            companyId: matchedCompany || sessionCompanyId,
            nome: result.funcionario.nome,
            cargo: result.funcionario.cargo,
            tipo: result.proximo_tipo ?? 'entrada',
            tipoLabel: result.proximo_tipo_label || result.proximo_tipo || 'entrada',
          });
        }
      } else if (result.nenhumRostoDetectado) {
        setError('Nenhum rosto detectado');
        setTimeout(() => setError(''), 1500);
      } else {
        setError('Rosto não reconhecido — tente novamente');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err: any) {
      setIsFlashing(false);
      await enableTorch(false).catch(() => {});

      // Network error: immediately probe backend. If down, suppress error toast —
      // the offline mode UI will take over on the next backendAvailable state update.
      const isNetworkError = !err?.response;
      if (isNetworkError) {
        const stillUp = await pingBackend();
        if (!stillUp) {
          console.log('[Kiosk] recognizeFace blocked: offline mode (detected from network error)');
          return; // Swallow error — KioskOfflineMode will render momentarily
        }
      }

      if (err?.response?.status === 403) {
        setError(`Acesso negado: ${err.response.data?.error || ''}`);
      } else if (err?.message?.includes('no faces')) {
        setError('Nenhum rosto detectado');
        setTimeout(() => setError(''), 1500);
      } else {
        setError('Não foi possível reconhecer o rosto. Tente novamente.');
        setTimeout(() => setError(''), 3000);
      }

      // Recuperação automática por erros consecutivos (kiosk only)
      if (localStorage.getItem('@kiosk:active') === 'true') {
        const n = ++errorCountRef.current;
        if (n >= 3) {
          kioskLog('RECOVERY_RELOAD', `${n} erros consecutivos`);
          setTimeout(() => window.location.reload(), 2_000);
        } else if (n >= 2) {
          kioskLog('FACIAL_RESTART', `${n} erros consecutivos`);
          setTimeout(() => { stopCamera(); setTimeout(() => startCamera(), 500); }, 1_500);
        } else {
          kioskLog('RECOVERY_CAMERA', `${n} erro consecutivo`);
        }
      }
    } finally {
      setIsProcessing(false);
      setIsFlashing(false);
    }
  };

  const handleCancelConfirmation = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setConfirmData(null);
  };

  const handleRegister = async () => {
    if (!confirmData || isProcessing) return;
    if (confirmData.companyId && sessionCompanyId && confirmData.companyId !== sessionCompanyId) {
      setError('Funcionário não pertence a esta empresa.');
      handleCancelConfirmation();
      return;
    }
    setIsProcessing(true);
    try {
      const dateStr = getSaoPauloTimeString();
      const horario = dateStr.slice(11, 16);

      const res: RegisterPointResult = await apiService.registerPointByFace(
        confirmData.id,
        confirmData.tipo,
        dateStr,
      );

      if (res.too_soon) {
        setError('Você já registrou em menos de 5 minutos');
        setTimeout(() => { setError(''); handleCancelConfirmation(); }, 3500);
        return;
      }
      if (res.success) {
        renewSession('empresa');
        if (capturedUrl) URL.revokeObjectURL(capturedUrl);
        setCapturedUrl(null);
        setConfirmData(null);
        setShowSuccess({
          nome: confirmData.nome,
          tipo: res.tipo || confirmData.tipo,
          tipo_label: res.tipo_label || confirmData.tipoLabel,
          horario,
        });
        setTimeout(() => setShowSuccess(false), 2000);
      } else if (res.ponto_completo) {
        setConfirmData(null);
        setPontoCompleto({ nome: confirmData.nome, cargo: confirmData.cargo });
      } else {
        throw new Error(res.error || 'Erro ao registrar ponto');
      }
    } catch {
      setError('Erro ao registrar ponto. Tente novamente.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Offline / backend-down mode ─────────────────────────────────────────────
  if (showOfflineMode) {
    return (
      <KioskOfflineMode
        companyId={sessionCompanyId || ''}
        onBack={() => navigate('/empresa')}
        onRecordQueued={refreshPendingCount}
      />
    );
  }

  // ─── Success Screen ───────────────────────────────────────────────────────────
  if (showSuccess) {
    const isEntrada = showSuccess.tipo === 'entrada';
    return (
      <div className={`fixed inset-0 flex items-center justify-center ${isEntrada ? 'bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500' : 'bg-gradient-to-br from-rose-700 via-rose-600 to-pink-500'}`}>
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="text-center text-white px-8 max-w-lg w-full"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
            className="w-28 h-28 mx-auto mb-8 bg-white/20 rounded-full flex items-center justify-center shadow-2xl border border-white/30"
          >
            {isEntrada
              ? <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
            }
          </motion.div>
          <p className="text-white/70 text-xl mb-1">{getGreeting()},</p>
          <h1 className="text-5xl font-black mb-6 leading-tight">{showSuccess.nome}!</h1>
          <div className="bg-white/15 rounded-2xl px-8 py-4 mb-5 border border-white/20 inline-block">
            <div className="text-4xl font-black tracking-wider">
              {(showSuccess.tipo_label || (isEntrada ? 'ENTRADA' : 'SAÍDA')).toUpperCase()}
            </div>
          </div>
          <div className="text-7xl font-black tracking-tight">{showSuccess.horario}</div>
        </motion.div>
      </div>
    );
  }

  // ─── Ponto Completo ───────────────────────────────────────────────────────────
  if (pontoCompleto) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex flex-col">
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 py-5 px-6 text-center">
          <KioskClock />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-8">
            <div className="w-28 h-28 mx-auto mb-5 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
              {capturedUrl
                ? <img src={capturedUrl} alt="Rosto" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-slate-700 flex items-center justify-center"><svg className="w-14 h-14 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
              }
            </div>
            <h2 className="text-white text-4xl font-black mb-5">{pontoCompleto.nome}</h2>
            <div className="bg-amber-500/20 border border-amber-400/40 rounded-2xl px-8 py-5 mb-4">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-amber-200 text-xl font-bold">Ponto já registrado hoje!</p>
              <p className="text-amber-100/60 text-base mt-1">Entrada e saída já foram registradas.</p>
            </div>
            <p className="text-white/40 text-sm">Voltando automaticamente...</p>
          </motion.div>
          <button
            onClick={() => { if (capturedUrl) URL.revokeObjectURL(capturedUrl); setCapturedUrl(null); setPontoCompleto(null); }}
            className="w-full max-w-md bg-white/10 hover:bg-white/20 text-white py-6 rounded-3xl border border-white/20 transition-all text-xl font-bold"
          >
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  // ─── Confirmation ─────────────────────────────────────────────────────────────
  if (confirmData) {
    const isEntrada = confirmData.tipo === 'entrada';
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col">
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 py-5 px-6 text-center">
          <KioskClock />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-8">
            <div className="w-32 h-32 mx-auto mb-5 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
              {capturedUrl
                ? <img src={capturedUrl} alt="Rosto" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-slate-700 flex items-center justify-center"><svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
              }
            </div>
            <p className="text-white/60 text-xl mb-1">Confirma que é você?</p>
            <h2 className="text-white text-5xl font-black mb-1">{confirmData.nome}</h2>
            {confirmData.cargo && <p className="text-white/50 text-xl mb-5">{confirmData.cargo}</p>}
            <div className={`inline-block px-8 py-3 rounded-2xl border ${isEntrada ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-rose-500/20 border-rose-400/40'}`}>
              <span className={`text-3xl font-black ${isEntrada ? 'text-emerald-300' : 'text-rose-300'}`}>
                {confirmData.tipoLabel.toUpperCase()}
              </span>
            </div>
            {error && <div className="mt-4 bg-rose-600/80 px-6 py-3 rounded-2xl"><p className="text-white text-lg font-bold">{error}</p></div>}
          </motion.div>
          <div className="w-full max-w-2xl space-y-4">
            <motion.button
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              onClick={handleRegister} disabled={isProcessing}
              className={`w-full text-white py-9 rounded-3xl shadow-2xl disabled:opacity-50 transition-all text-4xl font-black ${isEntrada ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'}`}
            >
              {isProcessing
                ? <span className="flex items-center justify-center gap-3"><svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Registrando...</span>
                : '✓ Confirmar'
              }
            </motion.button>
            <motion.button
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
              onClick={handleCancelConfirmation} disabled={isProcessing}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-7 rounded-3xl border border-white/20 transition-all text-3xl font-bold disabled:opacity-50"
            >
              ← Cancelar
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Camera View ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Flash toggle */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={async () => { const next = !flashEnabled; setFlashEnabled(next); if (!next) await enableTorch(false).catch(() => {}); }}
          className="p-3 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 transition-all"
        >
          <svg viewBox="0 0 24 24" className={`w-5 h-5 ${flashEnabled ? 'text-yellow-400' : 'text-white/50'}`} fill="currentColor">
            <path d="M11 21h-1l1-7H5l7-12v7h6l-6 12z" />
          </svg>
        </button>
      </div>

      {/* Status indicator: online + pending count */}
      <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm bg-emerald-500/20 border-emerald-500/40 text-emerald-300">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Online
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm bg-amber-500/20 border-amber-500/40 text-amber-300">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {pendingCount} pendente(s)
          </div>
        )}
        <AnimatePresence>
          {syncStatus === 'syncing' && (
            <motion.div key="syncing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm bg-blue-500/20 border-blue-500/40 text-blue-300">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Sincronizando...
            </motion.div>
          )}
          {syncStatus === 'synced' && (
            <motion.div key="synced" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm bg-emerald-500/20 border-emerald-500/40 text-emerald-300">
              ✓ Sincronizado
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Back button — bottom right corner, discrete */}
      <div className="absolute bottom-5 right-5 z-50">
        <button
          onClick={() => {
            localStorage.removeItem('@kiosk:active');
            clearKioskRestore();
            navigate('/empresa', { state: { fromKioskExit: true } });
          }}
          className="px-3 py-1.5 rounded-xl bg-black/30 border border-white/10 text-white/30 text-xs hover:text-white/60 hover:bg-black/50 transition-all"
        >
          Voltar
        </button>
      </div>

      {/* Flash overlay */}
      {isFlashing && <div className="absolute inset-0 bg-white z-40" />}

      {/* Camera */}
      {cameraStream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
      )}
      <div className="absolute inset-0 bg-black/25" />

      {/* Clock header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent pt-14 pb-8 px-6 z-10">
        <KioskClock />
      </div>

      {/* Face guide oval */}
      {cameraStream && !isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <motion.div
            animate={{
              borderColor: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.25)'],
              scale: [1, 1.03, 1],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-72 border-[3px] rounded-full"
            style={{ height: '22rem' }}
          />
        </div>
      )}

      {/* Status messages */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center z-10 px-6">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div key="err" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="bg-rose-600/90 backdrop-blur-sm px-10 py-5 rounded-3xl shadow-2xl">
              <p className="text-white text-xl font-bold text-center">{error}</p>
            </motion.div>
          )}
          {!error && isProcessing && (
            <motion.div key="proc" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="bg-slate-900/90 backdrop-blur-md px-10 py-5 rounded-3xl flex items-center gap-4 shadow-2xl border border-white/10">
              <svg className="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <span className="text-white text-2xl font-bold">Reconhecendo...</span>
            </motion.div>
          )}
          {!error && !isProcessing && cameraStream && (
            <motion.div key="inst" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="bg-black/70 backdrop-blur-sm px-10 py-5 rounded-3xl shadow-2xl">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-4xl">👆</span>
                <span className="text-white text-2xl font-bold">Toque na tela</span>
              </div>
              <p className="text-white/70 text-lg text-center">Posicione seu rosto no círculo</p>
            </motion.div>
          )}
          {!error && !isProcessing && !cameraStream && (
            <motion.div key="nocam" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-rose-900/80 px-10 py-5 rounded-3xl text-white text-center">
              <p className="text-xl font-bold mb-1">Câmera indisponível</p>
              <button onClick={startCamera} className="text-base underline text-white/70 mt-1">Tentar novamente</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tap to capture */}
      {cameraStream && !isProcessing && (
        <button onClick={handleCapture} className="absolute inset-0 z-5 cursor-pointer" aria-label="Capturar e reconhecer rosto" />
      )}

      <canvas ref={canvasRef} className="hidden" />

      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 z-20" />
        )}
      </AnimatePresence>
    </div>
  );
}
