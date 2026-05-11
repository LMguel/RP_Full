import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * QUIOSQUE DE PONTO FACIAL - VERSÃO CLEAN
 * 
 * Fluxo:
 * 1. Câmera em tela cheia
 * 2. Usuário posiciona o rosto
 * 3. Toque na tela → Captura automática
 * 4. Sistema reconhece o funcionário
 * 5. Mostra 2 botões: ENTRADA (verde) e SAÍDA (vermelho)
 * 6. Após registro: feedback visual + volta para câmera
 */
export default function KioskCleanUI() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  const { user, userType } = useAuth();

  // company_id da sessão autenticada (kiosk logado como empresa).
  // O backend é a fonte da verdade; esta validação no PWA é defesa em profundidade:
  // se por algum motivo o backend devolver um match cross-tenant, o PWA recusa
  // localmente e exibe TENANT_MISMATCH, evitando que o registro siga adiante.
  const sessionCompanyId = (userType === 'empresa' && user?.company_id) || null;

  // Estados principais
  const [cameraStream, setCameraStream] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState(null);
  const [pontoCompleto, setPontoCompleto] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(true);

  // Relógio
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Iniciar câmera automaticamente
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Conectar stream ao vídeo
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Garantir que, ao sair dos modais, o vídeo volte a tocar
  useEffect(() => {
    if (!confirmationData && !pontoCompleto && !showSuccess && cameraStream && videoRef.current) {
      try {
        videoRef.current.srcObject = cameraStream;
        const playPromise = videoRef.current.play?.();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch(err => console.warn('[KIOSK] video play failed:', err));
        }
      } catch (e) {
        console.warn('[KIOSK] Reattach/play failed', e);
      }
    }
  }, [confirmationData, pontoCompleto, showSuccess, cameraStream]);

  // Auto-dismiss da tela de ponto completo após 4 segundos
  useEffect(() => {
    if (!pontoCompleto) return;
    const timer = setTimeout(() => {
      if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
      setCapturedImageUrl(null);
      setPontoCompleto(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [pontoCompleto]);

  // Solicitar fullscreen
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.log('Fullscreen não suportado ou negado');
      }
    };
    enterFullscreen();
  }, []);

  // ==================== FUNÇÕES DE DATA/HORA ====================
  const getSaoPauloTime = () => {
    return new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getSaoPauloDate = () => {
    return new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getSaoPauloDateTime = () => {
    // Criar uma nova data ajustada para o fuso horário de São Paulo
    const now = new Date();
    const saoPauloOffset = -3; // UTC-3 (São Paulo)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (saoPauloOffset * 3600000));
  };

  // ==================== CÂMERA ====================
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      setCameraStream(stream);
      setError('');
    } catch (err) {
      console.error('Erro ao abrir câmera:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  // Tenta ativar/desativar a torch da câmera (se suportada)
  const enableTorch = async (enable = true) => {
    try {
      const track = cameraStream?.getVideoTracks?.()[0];
      if (!track) return false;
      const capabilities = track.getCapabilities?.();
      if (capabilities && capabilities.torch) {
        await track.applyConstraints?.({ advanced: [{ torch: enable }] });
        return true;
      }
    } catch (e) {
      console.warn('[KIOSK] Torch not available or failed', e);
    }
    return false;
  };

  // ==================== CAPTURA E RECONHECIMENTO ====================
  const handleCapture = async () => {
    if (!videoRef.current || isProcessing) return;

    setIsProcessing(true);
    setError('');

    try {
      // Se o flash está habilitado, tentar ativar torch; usar overlay como fallback
      let torchEnabled = false;
      if (flashEnabled) {
        torchEnabled = await enableTorch(true);
        if (!torchEnabled) {
          setIsFlashing(true);
          await new Promise(res => setTimeout(res, 180));
        }
      }

      // Capturar frame da câmera
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      if (!blob) {
        setError('Erro ao capturar imagem da câmera. Tente novamente.');
        setIsProcessing(false);
        setTimeout(() => {
          setError('');
        }, 2000);
        return;
      }

      // Chamar API de reconhecimento facial
      const recognitionResult = await apiService.recognizeFace(blob);

      // Desligar torch/flash imediatamente após captura
      try { await enableTorch(false); } catch (e) { /* ignore */ }
      setIsFlashing(false);

      console.log('[KIOSK] Recognition result:', recognitionResult);

      if (recognitionResult.reconhecido) {
        if (!recognitionResult.funcionario?.funcionario_id) {
          setError('❌ Erro: ID do funcionário não encontrado na resposta da API');
          setTimeout(() => setError(''), 3000);
          return;
        }

        // ================= DEFESA EM PROFUNDIDADE: TENANT CHECK =================
        const matchedCompanyId = recognitionResult.funcionario?.company_id;
        if (!sessionCompanyId) {
          console.error('[KIOSK][TENANT_MISMATCH] Sessão sem company_id; relogue como empresa.');
          setError('❌ Sessão inválida. Faça login novamente.');
          setTimeout(() => setError(''), 3000);
          return;
        }
        if (matchedCompanyId && matchedCompanyId !== sessionCompanyId) {
          console.error('[KIOSK][TENANT_MISMATCH] Backend devolveu funcionário de outra empresa.', { matchedCompanyId, sessionCompanyId });
          setError('❌ Funcionário não pertence a esta empresa.');
          setTimeout(() => setError(''), 3000);
          return;
        }
        // =====================================================================

        const blobUrl = URL.createObjectURL(blob);
        setCapturedImageUrl(blobUrl);

        if (recognitionResult.ponto_completo) {
          setPontoCompleto({
            nome: recognitionResult.funcionario.nome,
            cargo: recognitionResult.funcionario.cargo,
          });
        } else {
          setConfirmationData({
            id: recognitionResult.funcionario.funcionario_id,
            companyId: matchedCompanyId || sessionCompanyId,
            nome: recognitionResult.funcionario.nome,
            cargo: recognitionResult.funcionario.cargo,
            tipo: recognitionResult.proximo_tipo,
            tipoLabel: recognitionResult.proximo_tipo_label || recognitionResult.proximo_tipo,
          });
        }
      } else if (recognitionResult.nenhumRostoDetectado) {
        // Novo caso: nenhum rosto detectado
        setError('Nenhum rosto foi detectado');
        setIsProcessing(false); // Libera a UI imediatamente
        setTimeout(() => {
          setError('');
        }, 1500);
        return;
      } else {
        // Rosto não reconhecido - aguardando nova tentativa
        setError('Rosto não reconhecido - aguardando nova tentativa');
        setTimeout(() => setError(''), 3000);
        return;
      }

    } catch (err) {
      console.error('Erro no reconhecimento:', err);
      // Trata erro do Rekognition: "There are no faces in the image. Should be at least 1."
      if (err && (err.message?.includes('There are no faces in the image') || (typeof err === 'string' && err.includes('There are no faces in the image')))) {
        setError('Nenhum rosto foi detectado');
        setIsProcessing(false);
        setTimeout(() => {
          setError('');
        }, 1500);
      } else {
        setError('❌ Não foi possível reconhecer o rosto. Tente novamente.');
        setTimeout(() => setError(''), 3000);
      }
    } finally {
      setIsProcessing(false);
      // Garantir overlay desligado se algo der errado
      setIsFlashing(false);
    }
  };

  // ==================== REGISTRO DE PONTO ====================
  const handleCancelConfirmation = () => {
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageUrl(null);
    setConfirmationData(null);
  };

  const handleRegister = async () => {
    if (!confirmationData || isProcessing) return;

    if (confirmationData.companyId && sessionCompanyId &&
        confirmationData.companyId !== sessionCompanyId) {
      console.error('[KIOSK][TENANT_MISMATCH] Tentativa de registro cross-tenant bloqueada.', {
        matchedCompanyId: confirmationData.companyId,
        sessionCompanyId,
      });
      setError('❌ Funcionário não pertence a esta empresa.');
      handleCancelConfirmation();
      setTimeout(() => setError(''), 3000);
      return;
    }

    setIsProcessing(true);

    try {
      const dataHoraSP = getSaoPauloDateTime();
      const ano = dataHoraSP.getFullYear();
      const mes = String(dataHoraSP.getMonth() + 1).padStart(2, '0');
      const dia = String(dataHoraSP.getDate()).padStart(2, '0');
      const hora = String(dataHoraSP.getHours()).padStart(2, '0');
      const minuto = String(dataHoraSP.getMinutes()).padStart(2, '0');
      const segundo = String(dataHoraSP.getSeconds()).padStart(2, '0');

      const dataHoraString = `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
      const horarioFormatado = `${hora}:${minuto}`;

      const pontoResult = await apiService.registerPointByFace(
        confirmationData.id,
        confirmationData.tipo,
        dataHoraString
      );

      if (pontoResult.success) {
        if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
        setCapturedImageUrl(null);
        setConfirmationData(null);

        setShowSuccess({
          nome: confirmationData.nome,
          tipo: pontoResult.tipo || confirmationData.tipo,
          tipo_label: pontoResult.tipo_label || confirmationData.tipoLabel,
          horario: horarioFormatado
        });

        setTimeout(() => setShowSuccess(false), 1500);
      } else if (pontoResult.ponto_completo) {
        setConfirmationData(null);
        setPontoCompleto({ nome: confirmationData.nome, cargo: confirmationData.cargo });
      } else {
        throw new Error(pontoResult.error || 'Erro ao registrar ponto');
      }

    } catch (err) {
      console.error('Erro ao registrar ponto:', err);
      setError('❌ Erro ao registrar ponto. Tente novamente.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== RENDERIZAÇÃO ====================

  // Tela de sucesso
  if (showSuccess) {
    const isEntrada = showSuccess.tipo === 'entrada';
    return (
      <div className={`fixed inset-0 flex items-center justify-center z-50 ${isEntrada ? 'bg-gradient-to-br from-green-700 via-green-600 to-emerald-500' : 'bg-gradient-to-br from-red-700 via-red-600 to-rose-500'}`}>
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center text-white px-8 max-w-lg w-full"
        >
          {/* Ícone */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
            className="w-32 h-32 mx-auto mb-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl border border-white/30"
          >
            {isEntrada ? (
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
            )}
          </motion.div>

          <p className="text-white/80 text-2xl mb-2">{getGreeting()},</p>
          <h1 className="text-5xl font-bold mb-6 leading-tight">{showSuccess.nome}!</h1>

          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-8 py-5 mb-6 border border-white/20 inline-block">
            <div className="text-4xl font-black tracking-wider">
              {(showSuccess.tipo_label || (isEntrada ? 'ENTRADA' : 'SAÍDA')).toUpperCase()}
            </div>
          </div>

          <div className="text-7xl font-black tracking-tight">
            {showSuccess.horario}
          </div>
        </motion.div>
      </div>
    );
  }

  // Tela de ponto já registrado completamente
  if (pontoCompleto) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600 flex flex-col">
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />

        <div className="bg-white/[.08] backdrop-blur-md border-b border-white/10 py-6 px-6 text-center">
          <div className="text-white/60 text-lg mb-1">{getSaoPauloDate()}</div>
          <div className="text-white text-5xl font-bold tracking-tight">{getSaoPauloTime().slice(0, 5)}</div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-8"
          >
            <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
              {capturedImageUrl ? (
                <img src={capturedImageUrl} alt="Rosto" className="w-full h-full object-cover object-center" />
              ) : (
                <div className="w-full h-full bg-white/15 flex items-center justify-center">
                  <svg className="w-16 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>

            <h2 className="text-white text-4xl font-black mb-6">{pontoCompleto.nome}</h2>

            <div className="bg-amber-500/20 border border-amber-400/40 rounded-2xl px-8 py-6 mb-4">
              <div className="text-6xl mb-3">✅</div>
              <p className="text-amber-200 text-2xl font-bold">Ponto já registrado hoje!</p>
              <p className="text-amber-100/70 text-lg mt-2">Entrada e saída já foram registradas.</p>
            </div>

            <p className="text-white/40 text-base">Voltando automaticamente em alguns segundos...</p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => {
              if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
              setCapturedImageUrl(null);
              setPontoCompleto(null);
            }}
            className="w-full max-w-md bg-white/10 hover:bg-white/20 text-white py-7 rounded-3xl border border-white/20 transition-all"
          >
            <span className="text-2xl font-bold">← Voltar</span>
          </motion.button>
        </div>
      </div>
    );
  }

  // Modal de confirmação (após reconhecimento facial)
  if (confirmationData) {
    const isEntrada = confirmationData.tipo === 'entrada';
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex flex-col">
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />

        <div className="bg-white/[.08] backdrop-blur-md border-b border-white/10 py-6 px-6 text-center">
          <div className="text-white/60 text-lg mb-1">{getSaoPauloDate()}</div>
          <div className="text-white text-5xl font-bold tracking-tight">{getSaoPauloTime().slice(0, 5)}</div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-8"
          >
            {/* Foto do rosto capturado */}
            <div className="w-32 h-32 mx-auto mb-5 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
              {capturedImageUrl ? (
                <img src={capturedImageUrl} alt="Rosto reconhecido" className="w-full h-full object-cover object-center" />
              ) : (
                <div className="w-full h-full bg-white/15 flex items-center justify-center">
                  <svg className="w-16 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>

            <p className="text-white/70 text-xl mb-2">Confirma que este é você?</p>
            <h2 className="text-white text-5xl font-black mb-2 leading-tight">{confirmationData.nome}</h2>
            {confirmationData.cargo && (
              <p className="text-white/60 text-xl mb-5">{confirmationData.cargo}</p>
            )}

            {/* Tipo automático */}
            <div className={`inline-block px-8 py-3 rounded-2xl border ${isEntrada ? 'bg-green-500/20 border-green-400/40' : 'bg-red-500/20 border-red-400/40'}`}>
              <span className={`text-3xl font-black tracking-wider ${isEntrada ? 'text-green-300' : 'text-red-300'}`}>
                {(confirmationData.tipoLabel || (isEntrada ? 'ENTRADA' : 'SAÍDA')).toUpperCase()}
              </span>
            </div>

            {/* Erro inline */}
            {error && (
              <div className="mt-4 bg-red-600/80 px-6 py-3 rounded-2xl">
                <p className="text-white text-lg font-bold">{error}</p>
              </div>
            )}
          </motion.div>

          <div className="w-full max-w-2xl space-y-4">
            <motion.button
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              onClick={handleRegister}
              disabled={isProcessing}
              className={`w-full text-white py-10 rounded-3xl shadow-2xl disabled:opacity-50 transition-all ${isEntrada ? 'bg-green-500 hover:bg-green-400 active:bg-green-600' : 'bg-red-500 hover:bg-red-400 active:bg-red-600'}`}
            >
              {isProcessing ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-4xl font-black">Registrando...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-4xl font-black">Confirmar</span>
                </div>
              )}
            </motion.button>

            <motion.button
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              onClick={handleCancelConfirmation}
              disabled={isProcessing}
              className="w-full bg-white/10 hover:bg-white/20 active:bg-white/5 text-white py-8 rounded-3xl shadow-xl disabled:opacity-50 transition-all border border-white/20"
            >
              <span className="text-3xl font-bold">← Cancelar</span>
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // Tela principal - Câmera
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Botão de toggle de flash no canto superior esquerdo */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={async () => {
            const next = !flashEnabled;
            setFlashEnabled(next);
            if (!next) {
              try { await enableTorch(false); } catch (e) { /* ignore */ }
            }
          }}
          aria-pressed={flashEnabled}
          title={flashEnabled ? 'Flash ativado' : 'Flash desativado'}
          className="p-3 rounded-full bg-black/30 hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className={flashEnabled ? 'text-yellow-400' : 'text-white'} fill="currentColor">
            <path d="M11 21h-1l1-7H5l7-12v7h6l-6 12z" />
          </svg>
        </button>
      </div>

      {/* Flash overlay (tela branca) — aparece quando isFlashing === true */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white z-40" style={{ opacity: 1 }} />
      )}
      {/* Vídeo da câmera sempre visível */}
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

      {/* Overlay escuro */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Header com relógio */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent py-8 px-6 text-center z-10">
        <div className="text-white/60 text-xl mb-2">{getSaoPauloDate()}</div>
        <div className="text-white text-6xl font-bold drop-shadow-lg">
          {getSaoPauloTime().slice(0, 5)}
        </div>
      </div>

      {/* Guia facial */}
      {cameraStream && !isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{
              borderColor: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)'],
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-80 h-96 border-4 rounded-full"
          />
        </div>
      )}

      {/* Instruções e erros */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center z-10 px-6">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-600 backdrop-blur-sm px-12 py-6 rounded-3xl shadow-2xl"
            >
              <p className="text-white text-2xl font-bold text-center">
                {error}
              </p>
            </motion.div>
          )}
          {!error && isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-primary-800/90 backdrop-blur-md px-12 py-6 rounded-3xl flex items-center gap-4 shadow-2xl border border-white/10"
            >
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-white text-3xl font-bold">Reconhecendo...</span>
            </motion.div>
          )}
          {!error && !isProcessing && cameraStream && (
            <motion.div
              key="instruction"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-black/70 backdrop-blur-sm px-12 py-6 rounded-3xl shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-2">
                <span className="text-5xl">👆</span>
                <span className="text-white text-3xl font-bold">Toque na tela</span>
              </div>
              <p className="text-white/80 text-xl text-center">
                Posicione seu rosto no círculo
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Área clicável (tela inteira) - sempre disponível se não estiver processando */}
      {cameraStream && !isProcessing && (
        <button
          onClick={handleCapture}
          className="absolute inset-0 z-5 cursor-pointer"
          aria-label="Capturar e reconhecer rosto"
        />
      )}

      {/* Canvas oculto */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay de processamento */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 z-20"
          />
        )}
      </AnimatePresence>
    </div>
  );
}