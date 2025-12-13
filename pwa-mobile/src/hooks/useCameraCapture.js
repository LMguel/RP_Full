import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para captura contínua de frames da câmera
 * Usado no modo Quiosque para reconhecimento facial
 */
export function useCameraFrameCapture(videoRef, isActive = false, intervalMs = 2000) {
  const [currentFrame, setCurrentFrame] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const intervalRef = useRef(null);
  const canvasRef = useRef(null);

  // Criar canvas se não existir
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Capturar frame do vídeo
  const captureFrame = useCallback(() => {
    if (!videoRef?.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Verificar se vídeo está pronto
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.log('[FRAME] Vídeo não está pronto');
      return null;
    }

    try {
      // Ajustar canvas ao tamanho do vídeo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Desenhar frame
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Converter para blob (JPEG)
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('[FRAME] Frame capturado:', blob.size, 'bytes');
            setCurrentFrame(blob);
            resolve(blob);
          } else {
            console.error('[FRAME] Erro ao gerar blob');
            resolve(null);
          }
        }, 'image/jpeg', 0.8);
      });
    } catch (error) {
      console.error('[FRAME] Erro ao capturar:', error);
      return null;
    }
  }, [videoRef]);

  // Iniciar captura contínua
  const startCapture = useCallback(() => {
    if (isCapturing) return;

    console.log('[FRAME] Iniciando captura contínua...');
    setIsCapturing(true);

    // Capturar imediatamente
    captureFrame();

    // Capturar a cada intervalo
    intervalRef.current = setInterval(() => {
      captureFrame();
    }, intervalMs);
  }, [isCapturing, captureFrame, intervalMs]);

  // Parar captura
  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCapturing(false);
    setCurrentFrame(null);
    console.log('[FRAME] Captura parada');
  }, []);

  // Controlar captura baseado em isActive
  useEffect(() => {
    if (isActive) {
      startCapture();
    } else {
      stopCapture();
    }

    return () => {
      stopCapture();
    };
  }, [isActive, startCapture, stopCapture]);

  return {
    currentFrame,
    isCapturing,
    captureFrame,
    startCapture,
    stopCapture
  };
}

/**
 * Hook para relógio em tempo real
 * Exibe horário atualizado a cada segundo
 */
export function useLiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    time,
    formatted: time.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    date: time.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
}
