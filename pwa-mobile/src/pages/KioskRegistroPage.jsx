import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../services/api';

/**
 * Página de Registro por Reconhecimento Facial (Modo Quiosque)
 * 
 * Fluxo SIMPLES:
 * 1. Câmera sempre ligada mostrando preview
 * 2. Usuário toca na tela para capturar foto
 * 3. Foto é enviada para AWS Rekognition para comparação
 * 4. Se reconhecido, mostra prévia com dados do funcionário
 * 5. Usuário confirma ou recaptura
 * 6. Ao confirmar, registra ENTRADA ou SAÍDA
 */
export default function KioskRegistroPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Estados
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Estados de preview/confirmação
  const [previewMode, setPreviewMode] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [recognizedPerson, setRecognizedPerson] = useState(null);

  // Modal de sucesso
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Relógio atualizado
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Abrir câmera ao montar
  useEffect(() => {
    openCamera();
    return () => {
      closeCamera();
    };
  }, []);

  // Atualizar video element quando stream mudar
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Saudação baseada no horário
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getFormattedTime = () => {
    return currentTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Abrir câmera frontal com alta qualidade
  const openCamera = async () => {
    setCameraError('');
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera não suportada neste navegador');
      }

      console.log('[KIOSK] Abrindo câmera frontal...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false
      });

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      console.log('[KIOSK] Câmera aberta:', settings.width, 'x', settings.height);
      
      setCameraStream(stream);
      
    } catch (err) {
      console.error('[KIOSK] Erro ao abrir câmera:', err);
      
      let errorMessage = 'Erro ao acessar câmera';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Permissão de câmera negada. Habilite nas configurações.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera encontrada.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Câmera em uso por outro aplicativo.';
      }
      
      setCameraError(errorMessage);
    }
  };

  // Fechar câmera
  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  // Capturar foto e enviar para reconhecimento
  const handleCapture = async () => {
    if (!videoRef.current || isProcessing) return;

    setIsProcessing(true);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      
      // Espelhar a imagem (selfie mode)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedPhoto(photoDataUrl);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      console.log('[KIOSK] Foto capturada, enviando para reconhecimento...');

      const result = await apiService.recognizeFace(blob);
      console.log('[KIOSK] Resultado:', result);

      if (result.reconhecido && result.funcionario) {
        const funcId = result.funcionario.funcionario_id || result.funcionario.id;
        setRecognizedPerson({
          id: funcId,
          nome: result.funcionario.nome || result.funcionario.name || funcId,
          cargo: result.funcionario.cargo || result.funcionario.position || '',
          proximoTipo: result.proximo_tipo || 'entrada', // entrada ou saida baseado no último registro do dia
        });
        setPreviewMode(true);
      } else {
        setCapturedPhoto(null);
        alert('❌ Rosto não reconhecido. Tente novamente.');
      }

    } catch (err) {
      console.error('[KIOSK] Erro:', err);
      setCapturedPhoto(null);
      alert(err.response?.data?.error || 'Erro ao processar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmar registro de ponto
  const handleConfirm = async () => {
    if (!recognizedPerson || isProcessing) return;

    setIsProcessing(true);

    try {
      console.log('[KIOSK] Registrando ponto para:', recognizedPerson.id);

      const pontoResult = await apiService.registerPointByFace(recognizedPerson.id);
      console.log('[KIOSK] Ponto registrado:', pontoResult);

      if (pontoResult.success) {
        setSuccessData({
          nome: recognizedPerson.nome,
          tipo: pontoResult.tipo,
          horario: pontoResult.registro?.horario || getFormattedTime(),
        });
        setShowSuccess(true);

        setTimeout(() => {
          setShowSuccess(false);
          setSuccessData(null);
          resetToCamera();
        }, 4000);
      } else {
        throw new Error(pontoResult.error || 'Erro ao registrar ponto');
      }

    } catch (err) {
      console.error('[KIOSK] Erro ao registrar:', err);
      alert(err.response?.data?.error || err.message || 'Erro ao registrar ponto.');
      resetToCamera();
    } finally {
      setIsProcessing(false);
    }
  };

  // Recapturar foto
  const handleRetake = () => {
    resetToCamera();
  };

  // Resetar para modo câmera
  const resetToCamera = () => {
    setPreviewMode(false);
    setCapturedPhoto(null);
    setRecognizedPerson(null);
    setIsProcessing(false);
  };

  // Voltar ao menu
  const handleBack = () => {
    closeCamera();
    navigate('/', { replace: true });
  };

  // ==================== TELA DE PREVIEW/CONFIRMAÇÃO ====================
  if (previewMode && capturedPhoto && recognizedPerson) {
    return (
      <div className="min-h-screen bg-black flex flex-col relative">
        {/* Foto capturada como fundo */}
        <img 
          src={capturedPhoto} 
          alt="Preview" 
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Overlay escuro */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Card de confirmação */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md bg-white rounded-3xl p-8 shadow-2xl"
        >
          {/* Ícone de check */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
            Pessoa Reconhecida
          </h2>

          {/* Dados do funcionário */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Nome:</span>
              <span className="text-gray-800 font-bold text-lg">{recognizedPerson.nome}</span>
            </div>
            {recognizedPerson.cargo && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 font-medium">Cargo:</span>
                <span className="text-gray-800">{recognizedPerson.cargo}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Horário:</span>
              <span className="text-gray-800 font-semibold">{getFormattedTime()}</span>
            </div>
            {/* Tipo de registro que será feito */}
            <div className="flex justify-between items-center py-3 bg-gray-50 rounded-xl px-4">
              <span className="text-gray-500 font-medium">Registro:</span>
              <span className={`font-bold text-xl ${
                recognizedPerson.proximoTipo === 'entrada' 
                  ? 'text-green-600' 
                  : 'text-red-500'
              }`}>
                {recognizedPerson.proximoTipo === 'entrada' ? '🟢 ENTRADA' : '🔴 SAÍDA'}
              </span>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-4">
            <button
              onClick={handleRetake}
              disabled={isProcessing}
              className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              Recapturar
            </button>

            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processando...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmar
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Modal de Sucesso */}
        <AnimatePresence>
          {showSuccess && successData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="bg-white rounded-3xl p-10 max-w-md mx-4 text-center shadow-2xl"
              >
                <div className="text-7xl mb-6">✅</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {getGreeting()}, {successData.nome}!
                </h2>
                <div className={`text-2xl font-bold mb-4 ${
                  successData.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'
                }`}>
                  {successData.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Saída'}
                </div>
                <div className="text-xl text-gray-600">
                  {successData.horario}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ==================== TELA PRINCIPAL DA CÂMERA ====================
  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Câmera em tela cheia */}
      {cameraStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          {cameraError ? (
            <div className="text-center p-8">
              <div className="text-6xl mb-4">📸</div>
              <p className="text-red-400 text-lg mb-4">{cameraError}</p>
              <button
                onClick={openCamera}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg">Iniciando câmera...</p>
            </div>
          )}
        </div>
      )}

      {/* Relógio no topo */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="text-5xl font-bold text-white drop-shadow-lg">
          {getFormattedTime()}
        </div>
        <div className="text-center text-white/60 text-lg mt-1">
          {currentTime.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}
        </div>
      </div>

      {/* Botão voltar */}
      <button
        onClick={handleBack}
        className="absolute top-8 left-4 z-10 px-4 py-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
      >
        ← Voltar
      </button>

      {/* Guia facial */}
      {cameraStream && !isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{ 
              borderColor: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.3)'],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-64 h-80 border-4 rounded-full"
          />
        </div>
      )}

      {/* Instrução no rodapé */}
      <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10">
        {isProcessing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-black/80 backdrop-blur-sm px-8 py-4 rounded-2xl flex items-center gap-4"
          >
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-white text-xl font-medium">Reconhecendo...</span>
          </motion.div>
        ) : cameraStream && (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-black/60 backdrop-blur-sm px-8 py-4 rounded-2xl flex items-center gap-3"
          >
            <span className="text-4xl">👆</span>
            <span className="text-white text-xl font-semibold">Toque na tela para registrar</span>
          </motion.div>
        )}
      </div>

      {/* Área clicável para capturar (tela inteira) */}
      {cameraStream && !isProcessing && (
        <button
          onClick={handleCapture}
          className="absolute inset-0 z-5"
          aria-label="Capturar foto"
        />
      )}

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

      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
