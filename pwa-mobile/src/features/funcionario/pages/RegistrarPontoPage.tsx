import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '../../../hooks/useCamera';
import apiService from '../../../services/api';
import Button from '../../../components/ui/Button';
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

  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col safe-bottom">
      <div className="flex items-center px-5 pt-8 pb-2">
        <button
          onClick={() => navigate('/funcionario')}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-800"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-50 ml-1">Registrar Ponto</h1>
      </div>

      <div className="flex-1 flex flex-col px-5 pb-8 max-w-sm mx-auto w-full">
        <AnimatePresence mode="wait">

          {(step === 'loading' || step === 'ready' || step === 'processing') && (
            <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <p className="text-slate-500 text-sm text-center mb-4">Posicione seu rosto no centro para confirmar sua identidade</p>

              <div className="relative flex-1 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 min-h-[380px]">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover [transform:scaleX(-1)]" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[62%] aspect-[3/4] rounded-[50%] border-4 border-white/40" />
                </div>
                {!stream && !cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                )}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 px-6 text-center">
                    <p className="text-rose-400 text-sm mb-4">{cameraError}</p>
                    <Button size="sm" onClick={() => { setCameraError(''); startCamera(); }}>Tentar novamente</Button>
                  </div>
                )}
                {step === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                    <div className="w-10 h-10 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <Button
                size="lg"
                fullWidth
                className="mt-5"
                disabled={!stream || step === 'processing'}
                loading={step === 'processing'}
                onClick={handleRegistrar}
              >
                Registrar Ponto
              </Button>
            </motion.div>
          )}

          {step === 'success' && result && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mb-5">
                <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-50 mb-1">{result.tipo_label || 'Ponto'} registrado!</h2>
              {result.timestamp && (
                <p className="text-slate-400 text-base font-mono">
                  {new Date(result.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                </p>
              )}
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-rose-500/15 rounded-full flex items-center justify-center mb-5">
                <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-50 mb-2">Não foi possível registrar</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-xs">{errorMsg}</p>
              <Button size="lg" fullWidth onClick={handleTryAgain}>Tentar novamente</Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
