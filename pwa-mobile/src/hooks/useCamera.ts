import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Hook de câmera single-shot para telas de funcionário (cadastro de foto e
 * registro de ponto). Diferente de `useCameraFrameCapture` (captura contínua
 * por intervalo, usado no kiosk) — aqui a captura é sob demanda, 1 foto por
 * vez, disparada por um toque do usuário.
 *
 * Padrão de aquisição de câmera (getUserMedia) e de captura (canvas→JPEG
 * Blob, com espelhamento horizontal para bater com a preview) extraído de
 * `features/kiosk/KioskPage.tsx` (startCamera/stopCamera/handleCapture),
 * que é o único código de câmera testado em produção hoje.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return; // já rodando
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setError('');
    } catch {
      setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  }, []);

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError('Câmera ainda inicializando. Aguarde um instante.');
      return null;
    }
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Espelha horizontalmente para o arquivo salvo bater com o que o
    // funcionário viu na preview (mesmo padrão do kiosk).
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!blob) setError('Erro ao capturar a foto. Tente novamente.');
    return blob;
  }, []);

  // Garante que a câmera nunca fique presa ligada se o componente
  // desmontar sem chamar stopCamera explicitamente (troca de rota, erro, etc).
  useEffect(() => () => stopCamera(), [stopCamera]);

  return { videoRef, stream, error, setError, startCamera, stopCamera, capturePhoto };
}
