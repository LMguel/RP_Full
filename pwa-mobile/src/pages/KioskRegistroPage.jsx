import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

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

  // Estados principais
  const [cameraStream, setCameraStream] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedPerson, setRecognizedPerson] = useState(null);
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

  // Garantir que, ao sair dos modais (recognizedPerson/showSuccess), o vídeo volte a tocar
  useEffect(() => {
    if (!recognizedPerson && !showSuccess && cameraStream && videoRef.current) {
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
  }, [recognizedPerson, showSuccess, cameraStream]);

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
        console.log('[KIOSK] Funcionario data:', recognitionResult.funcionario);
        console.log('[KIOSK] Funcionario ID:', recognitionResult.funcionario?.funcionario_id);

        if (!recognitionResult.funcionario?.funcionario_id) {
          console.error('[KIOSK] ERROR: Funcionario ID is missing from API response');
          setError('❌ Erro: ID do funcionário não encontrado na resposta da API');
          setTimeout(() => setError(''), 3000);
          return;
        }

        setRecognizedPerson({
          id: recognitionResult.funcionario.funcionario_id,
          nome: recognitionResult.funcionario.nome,
          cargo: recognitionResult.funcionario.cargo,
          sugestedType: recognitionResult.proximo_tipo,
          sugestedTypeLabel: recognitionResult.proximo_tipo_label || recognitionResult.proximo_tipo
        });

        console.log('[KIOSK] Recognized person set:', {
          id: recognitionResult.funcionario.funcionario_id,
          nome: recognitionResult.funcionario.nome,
          cargo: recognitionResult.funcionario.cargo,
          sugestedType: recognitionResult.proximo_tipo,
          sugestedTypeLabel: recognitionResult.proximo_tipo_label
        });
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
  const handleRegister = async (tipo) => {
    if (!recognizedPerson || isProcessing) return;

    setIsProcessing(true);

    try {
      // Obter horário atual de São Paulo
      const dataHoraSP = getSaoPauloDateTime();

      // Criar string no formato que o backend espera
      const ano = dataHoraSP.getFullYear();
      const mes = String(dataHoraSP.getMonth() + 1).padStart(2, '0');
      const dia = String(dataHoraSP.getDate()).padStart(2, '0');
      const hora = String(dataHoraSP.getHours()).padStart(2, '0');
      const minuto = String(dataHoraSP.getMinutes()).padStart(2, '0');
      const segundo = String(dataHoraSP.getSeconds()).padStart(2, '0');

      const dataHoraString = `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
      const horarioFormatado = `${hora}:${minuto}`;

      const pontoResult = await apiService.registerPointByFace(
        recognizedPerson.id,
        tipo,
        dataHoraString
      );

      if (pontoResult.success) {
        setShowSuccess({
          nome: recognizedPerson.nome,
          tipo: pontoResult.tipo || tipo,
          tipo_label: pontoResult.tipo_label || tipo,
          horario: horarioFormatado
        });

        // Resetar após 1.5 segundos para fluxo mais rápido
        setTimeout(() => {
          setShowSuccess(false);
          setRecognizedPerson(null);
        }, 1500);
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
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center z-50">
        {/* Vídeo continua rodando em background (invisível) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="hidden"
        />
        
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center text-white px-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-9xl mb-8"
          >
            ✅
          </motion.div>
          
          <h1 className="text-5xl font-bold mb-4">
            {getGreeting()}, {showSuccess.nome}!
          </h1>
          
          <div className="text-7xl font-black mb-6">
            {(() => {
              const tipo = showSuccess.tipo;
              const tipoLabel = showSuccess.tipo_label || (tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA');
              const emoji = tipo === 'entrada' ? '🟢' : '🔴';
              return `${emoji} ${tipoLabel.toUpperCase()}`;
            })()}
          </div>
          
          <div className="text-6xl font-bold opacity-90">
            {showSuccess.horario}
          </div>
        </motion.div>
      </div>
    );
  }

  // Tela de seleção de tipo (após reconhecimento)
  if (recognizedPerson) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col">
        {/* Vídeo continua rodando em background (invisível) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="hidden"
        />
        
        {/* Header */}
        <div className="bg-black/30 backdrop-blur-sm py-8 px-6 text-center">
          <div className="text-white/60 text-xl mb-2">{getSaoPauloDate()}</div>
          <div className="text-white text-5xl font-bold">{getSaoPauloTime().slice(0, 5)}</div>
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-12"
          >
            <div className="text-8xl mb-6">👤</div>
            <h2 className="text-white text-4xl font-bold mb-2">
              {getGreeting()}!
            </h2>
            <p className="text-white text-5xl font-black mb-2">
              {recognizedPerson.nome}
            </p>
            {recognizedPerson.cargo && (
              <p className="text-white/70 text-2xl">{recognizedPerson.cargo}</p>
            )}
          </motion.div>

          {/* Botões de registro - ENTRADA e SAÍDA */}
          <div className="w-full max-w-2xl space-y-6">
            {/* Botão ENTRADA */}
            <motion.button
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={() => handleRegister('entrada')}
              disabled={isProcessing}
              className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white py-14 rounded-3xl shadow-2xl disabled:opacity-50 transition-all transform hover:scale-105"
            >
              <div className="flex items-center justify-center gap-6">
                <span className="text-7xl">🟢</span>
                <span className="text-5xl font-black">ENTRADA</span>
              </div>
            </motion.button>

            {/* Botão SAÍDA */}
            <motion.button
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              onClick={() => handleRegister('saida')}
              disabled={isProcessing}
              className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white py-14 rounded-3xl shadow-2xl disabled:opacity-50 transition-all transform hover:scale-105"
            >
              <div className="flex items-center justify-center gap-6">
                <span className="text-7xl">🔴</span>
                <span className="text-5xl font-black">SAÍDA</span>
              </div>
            </motion.button>
          </div>

          {/* Botão cancelar */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={() => setRecognizedPerson(null)}
            className="mt-12 text-white/60 hover:text-white text-xl font-medium"
          >
            ← Voltar
          </motion.button>
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
              className="bg-blue-600 backdrop-blur-sm px-12 py-6 rounded-3xl flex items-center gap-4 shadow-2xl"
            >
              <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
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