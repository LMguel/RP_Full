import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '../../../hooks/useCamera';
import apiService from '../../../services/api';
import Button from '../../../components/ui/Button';
import KioskClock from '../../kiosk/components/KioskClock';
import type { RegisterPointResult } from '../../../types';

type Step = 'loading' | 'ready' | 'processing' | 'success' | 'error';

const MOTIVO_MESSAGES: Record<string, string> = {
  rosto_nao_confere: 'O rosto não confere com o seu cadastro. Tente novamente ou procure o RH.',
  nenhum_rosto: 'Não encontramos seu rosto na foto. Posicione-se no centro, com boa iluminação.',
  foto_ja_cadastrada: 'Você já tem uma foto cadastrada.',
};

/**
 * Registro de ponto do funcionário: reconhecimento facial (obrigatório) +
 * geolocalização (best-effort, nunca bloqueia — Portaria 671/2021). O status
 * de "fora do raio" NUNCA é exibido aqui, só no painel administrativo.
 */
export default function RegistrarPontoPage() {
  const navigate = useNavigate();
  const { videoRef, stream, error: cameraError, setError: setCameraError, startCamera, stopCamera, capturePhoto } = useCamera();

  const [step, setStep] = useState<Step>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<RegisterPointResult | null>(null);
  const geoRef = useRef<{ latitude?: number; longitude?: number; accuracy?: number }>({});

  useEffect(() => {
    startCamera().then(() => setStep('ready'));

    // GPS é melhor-esforço: não bloqueia a UI se demorar ou for negado.
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          geoRef.current = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
        },
        () => { /* silencioso — segue sem GPS, backend trata como indisponível */ },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    }

    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegistrar = useCallback(async () => {
    setStep('processing');
    setErrorMsg('');
    const blob = await capturePhoto();
    if (!blob) {
      setStep('ready');
      return;
    }
    const res = await apiService.registrarPontoFuncionario(blob, geoRef.current);
    setResult(res);
    if (res.success) {
      stopCamera();
      setStep('success');
      setTimeout(() => navigate('/funcionario', { replace: true }), 1800);
    } else {
      stopCamera();
      setErrorMsg(
        (res.motivo && MOTIVO_MESSAGES[res.motivo]) || res.error || 'Não foi possível registrar seu ponto.'
      );
      setStep('error');
    }
  }, [capturePhoto, navigate, stopCamera]);

  const handleTryAgain = () => {
    setErrorMsg('');
    setResult(null);
    setStep('loading');
    startCamera().then(() => setStep('ready'));
  };

  const canTap = step === 'ready' && !!stream && !cameraError;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden safe-bottom">
      <AnimatePresence mode="wait">

        {(step === 'loading' || step === 'ready' || step === 'processing') && (
          <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
            {/* Câmera em tela cheia */}
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]" />
            <div className="absolute inset-0 bg-black/25" />

            {/* Relógio — mesmo cabeçalho do kiosk */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent pt-14 pb-8 px-6 z-10 pointer-events-none">
              <KioskClock />
            </div>

            {/* Voltar — discreto, canto inferior direito (mesmo padrão do kiosk) */}
            <div className="absolute bottom-5 right-5 z-30">
              <button
                onClick={() => navigate('/funcionario')}
                className="px-3 py-1.5 rounded-xl bg-black/30 border border-white/10 text-white/40 text-xs hover:text-white/70 hover:bg-black/50 transition-all"
              >
                ← Voltar
              </button>
            </div>

            {/* Guia de rosto — círculo */}
            {stream && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <motion.div
                  animate={
                    step === 'processing'
                      ? { borderColor: 'rgba(59,130,246,0.9)', scale: 1 }
                      : { borderColor: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.25)'], scale: [1, 1.03, 1] }
                  }
                  transition={step === 'processing' ? { duration: 0.3 } : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-72 h-72 rounded-full border-[3px]"
                />
              </div>
            )}

            {(!stream && !cameraError) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-9 h-9 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center z-20">
                <p className="text-rose-300 text-base mb-5">{cameraError}</p>
                <Button size="sm" onClick={() => { setCameraError(''); startCamera(); }}>Tentar novamente</Button>
              </div>
            )}

            {/* Instrução inferior */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center z-20 px-6 pb-12 bg-gradient-to-t from-black/80 to-transparent pt-16">
              <AnimatePresence mode="wait">
                {step === 'processing' ? (
                  <motion.div key="proc" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                    className="bg-slate-900/90 backdrop-blur-md px-8 py-4 rounded-3xl flex items-center gap-3 border border-white/10">
                    <svg className="animate-spin w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-white text-lg font-semibold">Registrando...</span>
                  </motion.div>
                ) : canTap ? (
                  <motion.button
                    key="tap"
                    onClick={handleRegistrar}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex flex-col items-center gap-1 bg-black/60 backdrop-blur-sm px-9 py-4 rounded-3xl border border-white/15"
                  >
                    <span className="text-white text-lg font-bold">Toque na tela para registrar</span>
                    <span className="text-white/60 text-sm">Posicione seu rosto no círculo</span>
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Área de toque para capturar */}
            {canTap && (
              <button onClick={handleRegistrar} className="absolute inset-0 z-5" aria-label="Registrar ponto" />
            )}
          </motion.div>
        )}

        {step === 'success' && result && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 border border-white/30">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </motion.div>
            <h2 className="text-3xl font-black text-white mb-2">{result.tipo_label || 'Ponto'} registrado!</h2>
            {result.timestamp && (
              <p className="text-white/80 text-2xl font-mono font-bold">
                {new Date(result.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
              </p>
            )}
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-slate-950">
            <div className="w-20 h-20 bg-rose-500/15 rounded-full flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-50 mb-2">Não foi possível registrar</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-xs">{errorMsg}</p>
            <Button size="lg" onClick={handleTryAgain}>Tentar novamente</Button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
