import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '../../../hooks/useCamera';
import apiService from '../../../services/api';
import Button from '../../../components/ui/Button';

type Step = 'intro' | 'camera' | 'preview' | 'submitting' | 'done';

/**
 * Cadastro de foto/biometria facial no primeiro acesso do funcionário.
 * Só é possível uma vez — depois disso, trocar a foto é exclusivo do RH
 * pelo painel (decisão de produto: evitar troca de biometria sem supervisão).
 */
export default function CadastroFotoPage() {
  const navigate = useNavigate();
  const { videoRef, stream, error: cameraError, setError: setCameraError, startCamera, stopCamera, capturePhoto } = useCamera();

  const [step, setStep] = useState<Step>('intro');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (step === 'camera') startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    return () => { if (photoUrl) URL.revokeObjectURL(photoUrl); };
  }, [photoUrl]);

  const handleCapture = async () => {
    const blob = await capturePhoto();
    if (!blob) return;
    setPhotoBlob(blob);
    setPhotoUrl(URL.createObjectURL(blob));
    stopCamera();
    setStep('preview');
  };

  const handleRetake = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoBlob(null);
    setSubmitError('');
    setStep('camera');
  };

  const handleConfirm = async () => {
    if (!photoBlob) return;
    setStep('submitting');
    setSubmitError('');
    const result = await apiService.cadastrarFotoFuncionario(photoBlob);
    if (result.success) {
      sessionStorage.setItem('@app:temFotoCadastrada', 'true');
      setStep('done');
      setTimeout(() => navigate('/funcionario', { replace: true }), 1600);
    } else {
      setSubmitError(result.error || 'Não foi possível cadastrar sua foto.');
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden safe-bottom">
      <AnimatePresence mode="wait">

        {step === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950 flex flex-col justify-center text-center px-6 max-w-sm mx-auto w-full">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-50 mb-3">Cadastrar Rosto</h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-1">
              Antes de bater seu primeiro ponto, precisamos cadastrar seu rosto.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              Ele será usado só para confirmar sua identidade na hora do registro — e só pode ser cadastrado uma vez. Para trocar depois, fale com o RH.
            </p>
            <Button size="lg" fullWidth className="mt-8" onClick={() => setStep('camera')}>
              Continuar
            </Button>
          </motion.div>
        )}

        {step === 'camera' && (
          <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
            {/* Câmera em tela cheia */}
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]" />
            <div className="absolute inset-0 bg-black/25" />

            {/* Guia de rosto — círculo */}
            {stream && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <motion.div
                  animate={{ borderColor: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.25)'], scale: [1, 1.03, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
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
              {stream && !cameraError && (
                <motion.button
                  key="tap"
                  onClick={handleCapture}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex flex-col items-center gap-1 bg-black/60 backdrop-blur-sm px-9 py-4 rounded-3xl border border-white/15"
                >
                  <span className="text-white text-lg font-bold">Toque na tela para cadastrar</span>
                  <span className="text-white/60 text-sm">Posicione seu rosto no círculo</span>
                </motion.button>
              )}
            </div>

            {stream && !cameraError && (
              <button onClick={handleCapture} className="absolute inset-0 z-5" aria-label="Capturar rosto" />
            )}
          </motion.div>
        )}

        {step === 'preview' && photoUrl && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col bg-slate-950 px-5 pt-10 pb-8 max-w-sm mx-auto w-full safe-bottom">
            <h2 className="text-lg font-bold text-slate-50 text-center mb-1">Ficou boa?</h2>
            <p className="text-slate-500 text-sm text-center mb-5">Confira se seu rosto está nítido e bem enquadrado</p>

            <div className="relative flex-1 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 min-h-[360px]">
              <img src={photoUrl} alt="Prévia da foto capturada" className="w-full h-full object-cover" />
            </div>

            {submitError && (
              <div className="mt-4 bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3">
                <p className="text-rose-400 text-sm">{submitError}</p>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <Button size="lg" variant="outline" className="flex-1" onClick={handleRetake}>
                Refazer
              </Button>
              <Button size="lg" className="flex-1" onClick={handleConfirm}>
                Confirmar
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'submitting' && (
          <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-center bg-slate-950">
            <div className="w-10 h-10 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-5" />
            <p className="text-slate-300">Cadastrando seu rosto...</p>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-center bg-slate-950">
            <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-50 mb-1">Rosto cadastrado!</h2>
            <p className="text-slate-500 text-sm">Você já pode bater seu ponto.</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
