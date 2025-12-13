import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para gerenciar permissão de câmera
 * Solicita e armazena o estado da permissão
 */
export function useCameraPermission() {
  const [permission, setPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);

  // Verificar permissão atual
  const checkPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        setPermission(result.state);
        
        // Observar mudanças
        result.addEventListener('change', () => {
          setPermission(result.state);
        });
      }
    } catch (err) {
      console.log('[CAMERA] Não foi possível verificar permissão:', err);
    }
  }, []);

  // Solicitar permissão e abrir câmera
  const requestPermission = useCallback(async (facingMode = 'user') => {
    setError(null);
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera não suportada neste navegador');
      }

      const constraints = {
        video: {
          facingMode: facingMode, // 'user' (frontal) ou 'environment' (traseira)
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      console.log('[CAMERA] Solicitando acesso à câmera...');
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      setPermission('granted');
      console.log('[CAMERA] Permissão concedida');
      
      return mediaStream;
    } catch (err) {
      console.error('[CAMERA] Erro ao solicitar permissão:', err);
      
      let errorMessage = 'Erro ao acessar câmera';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permissão de câmera negada. Habilite nas configurações do navegador.';
        setPermission('denied');
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Câmera já está em uso por outro aplicativo.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Acesso à câmera requer HTTPS (exceto localhost).';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Parar stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('[CAMERA] Track parado');
      });
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    checkPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez na montagem

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]); // Dependência apenas do stream

  return {
    permission,
    error,
    stream,
    requestPermission,
    stopCamera,
    hasPermission: permission === 'granted'
  };
}

/**
 * Hook para gerenciar permissão de geolocalização
 */
export function useGeolocationPermission() {
  const [permission, setPermission] = useState('prompt');
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  // Verificar permissão atual
  const checkPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermission(result.state);
        
        result.addEventListener('change', () => {
          setPermission(result.state);
        });
      }
    } catch (err) {
      console.log('[GPS] Não foi possível verificar permissão:', err);
    }
  }, []);

  // Solicitar localização com estratégia de fallback
  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLocation(null);

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocalização não suportada neste navegador');
      }

      console.log('[GPS] Solicitando localização...');

      // Função auxiliar para obter posição
      const getPosition = (highAccuracy, timeout, maxAge) => {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: highAccuracy,
              timeout: timeout,
              maximumAge: maxAge
            }
          );
        });
      };

      let position;
      
      // Estratégia em 3 níveis (funciona em desktop e mobile):
      try {
        // 1. Cache/IP (mais rápido, funciona em desktop)
        console.log('[GPS] Tentando localização rápida (cache/IP)...');
        position = await getPosition(false, 8000, 300000);
        console.log('[GPS] Localização obtida (cache/IP)');
      } catch (e1) {
        try {
          // 2. Baixa precisão sem cache
          console.log('[GPS] Tentando baixa precisão...');
          position = await getPosition(false, 15000, 0);
          console.log('[GPS] Localização obtida (baixa precisão)');
        } catch (e2) {
          // 3. Alta precisão (GPS)
          console.log('[GPS] Tentando GPS (alta precisão)...');
          position = await getPosition(true, 30000, 0);
          console.log('[GPS] Localização obtida (GPS)');
        }
      }

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        timestamp: position.timestamp
      };

      console.log('[GPS] Localização final:', coords);
      setLocation(coords);
      setPermission('granted');
      setLoading(false);
      return coords;

    } catch (err) {
      console.error('[GPS] Erro ao obter localização:', err);
      
      let errorMessage = 'Erro ao obter localização';
      
      if (err.code === 1) { // PERMISSION_DENIED
        errorMessage = 'Permissão de localização negada. Habilite nas configurações.';
        setPermission('denied');
      } else if (err.code === 2) { // POSITION_UNAVAILABLE
        errorMessage = 'Localização indisponível. Verifique suas configurações de rede.';
      } else if (err.code === 3) { // TIMEOUT
        errorMessage = 'Não foi possível obter localização. Tente novamente.';
      }
      
      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    permission,
    error,
    location,
    loading,
    requestLocation,
    hasPermission: permission === 'granted'
  };
}
