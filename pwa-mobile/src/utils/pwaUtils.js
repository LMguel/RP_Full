/**
 * Utilitários PWA para câmera e localização
 * Garante compatibilidade com iOS Safari e Android Chrome
 * IMPORTANTE: Todas as funções devem ser chamadas após interação do usuário
 */

/**
 * Solicita permissão e obtém localização atual do dispositivo
 * Usa GPS de alta precisão
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number}>}
 */
export const getLocation = () => {
  return new Promise(async (resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste navegador'));
      return;
    }

    console.log('[PWA] Solicitando localização...');

    // Função auxiliar para obter posição
    const getPosition = (highAccuracy, timeout, maxAge) => {
      return new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(
          res,
          rej,
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeout,
            maximumAge: maxAge
          }
        );
      });
    };

    try {
      let position;
      
      // Estratégia em 3 níveis:
      // 1. Baixa precisão com cache (mais rápido, funciona em desktop por IP)
      // 2. Baixa precisão sem cache
      // 3. Alta precisão (GPS em mobile)
      
      try {
        console.log('[PWA] Tentando localização rápida (cache/IP)...');
        position = await getPosition(false, 8000, 300000); // Cache de 5 min
        console.log('[PWA] Localização obtida via cache/IP');
      } catch (e1) {
        console.log('[PWA] Cache/IP falhou, tentando baixa precisão...');
        try {
          position = await getPosition(false, 15000, 0);
          console.log('[PWA] Localização obtida (baixa precisão)');
        } catch (e2) {
          console.log('[PWA] Baixa precisão falhou, tentando GPS...');
          position = await getPosition(true, 30000, 0);
          console.log('[PWA] Localização obtida via GPS');
        }
      }

      console.log('[PWA] Localização obtida com sucesso:', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp
      });
    } catch (error) {
      console.error('[PWA] Erro ao obter localização:', error);
      
      let errorMessage = 'Erro ao obter localização';
      
      if (error.code === 1) {
        errorMessage = 'Permissão de localização negada. Habilite nas configurações do navegador.';
      } else if (error.code === 2) {
        errorMessage = 'Localização indisponível. Verifique suas configurações de rede.';
      } else if (error.code === 3) {
        errorMessage = 'Não foi possível obter localização. Tente novamente.';
      } else {
        errorMessage = `Erro: ${error.message}`;
      }
      
      reject(new Error(errorMessage));
    }
  });
};

/**
 * Observa a localização continuamente (útil para rastreamento em tempo real)
 * @param {Function} onSuccess - Callback chamado a cada atualização de localização
 * @param {Function} onError - Callback chamado em caso de erro
 * @returns {number} watchId - ID para parar o monitoramento com clearWatch
 */
export const watchLocation = (onSuccess, onError) => {
  if (!navigator.geolocation) {
    onError(new Error('Geolocalização não suportada'));
    return null;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000 // Aceita cache de até 5 segundos
  };

  return navigator.geolocation.watchPosition(onSuccess, onError, options);
};

/**
 * Para o monitoramento de localização
 * @param {number} watchId - ID retornado por watchLocation
 */
export const stopWatchingLocation = (watchId) => {
  if (watchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    console.log('[PWA] Monitoramento de localização parado');
  }
};

/**
 * Abre a câmera e retorna o stream de vídeo
 * IMPORTANTE: Deve ser chamado após interação do usuário (clique em botão)
 * @param {string} facingMode - 'user' (frontal) ou 'environment' (traseira)
 * @param {Object} constraints - Configurações adicionais da câmera
 * @returns {Promise<MediaStream>}
 */
export const openCamera = async (facingMode = 'user', constraints = {}) => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Câmera não suportada neste navegador');
    }

    const defaultConstraints = {
      video: {
        facingMode: facingMode, // 'user' ou 'environment'
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: { ideal: 16/9 }
      },
      audio: false
    };

    const finalConstraints = {
      ...defaultConstraints,
      ...constraints
    };

    console.log('[PWA] Solicitando acesso à câmera...', finalConstraints);
    const stream = await navigator.mediaDevices.getUserMedia(finalConstraints);
    console.log('[PWA] Câmera aberta com sucesso');
    
    return stream;
  } catch (error) {
    console.error('[PWA] Erro ao abrir câmera:', error);
    
    let errorMessage = 'Erro ao acessar câmera';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = 'Permissão de câmera negada. Habilite nas configurações do navegador.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = 'Câmera já está em uso por outro aplicativo.';
    } else if (error.name === 'OverconstrainedError') {
      errorMessage = 'Câmera não suporta as configurações solicitadas.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Acesso à câmera requer HTTPS (exceto localhost).';
    } else if (error.name === 'TypeError') {
      errorMessage = 'Configurações de câmera inválidas.';
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Para todos os tracks do stream da câmera
 * @param {MediaStream} stream - Stream retornado por openCamera
 */
export const stopCamera = (stream) => {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop();
      console.log('[PWA] Track de vídeo parado:', track.kind);
    });
  }
};

/**
 * Captura uma foto do elemento de vídeo
 * @param {HTMLVideoElement} videoElement - Elemento de vídeo com o stream ativo
 * @param {string} format - Formato da imagem ('image/jpeg', 'image/png')
 * @param {number} quality - Qualidade (0.0 a 1.0) - apenas para JPEG
 * @returns {Promise<Blob>}
 */
export const capturePhoto = (videoElement, format = 'image/jpeg', quality = 0.95) => {
  return new Promise((resolve, reject) => {
    try {
      if (!videoElement || !videoElement.videoWidth) {
        throw new Error('Elemento de vídeo inválido ou não carregado');
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('[PWA] Foto capturada:', blob.size, 'bytes');
          resolve(blob);
        } else {
          reject(new Error('Erro ao gerar blob da imagem'));
        }
      }, format, quality);
    } catch (error) {
      console.error('[PWA] Erro ao capturar foto:', error);
      reject(error);
    }
  });
};

/**
 * Captura foto como Data URL (base64)
 * @param {HTMLVideoElement} videoElement 
 * @param {string} format 
 * @param {number} quality 
 * @returns {string} Data URL
 */
export const capturePhotoAsDataURL = (videoElement, format = 'image/jpeg', quality = 0.95) => {
  if (!videoElement || !videoElement.videoWidth) {
    throw new Error('Elemento de vídeo inválido');
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  return canvas.toDataURL(format, quality);
};

/**
 * Lista todas as câmeras disponíveis no dispositivo
 * @returns {Promise<Array>}
 */
export const listCameras = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      throw new Error('API de dispositivos de mídia não suportada');
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === 'videoinput');
    
    console.log('[PWA] Câmeras encontradas:', cameras.length);
    return cameras;
  } catch (error) {
    console.error('[PWA] Erro ao listar câmeras:', error);
    throw error;
  }
};

/**
 * Verifica se está rodando como PWA instalado
 * @returns {boolean}
 */
export const isPWAInstalled = () => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = window.navigator.standalone === true;
  const isInWebApp = isStandalone || isIOSStandalone;
  
  console.log('[PWA] Status de instalação:', {
    standalone: isStandalone,
    iosStandalone: isIOSStandalone,
    isPWA: isInWebApp
  });
  
  return isInWebApp;
};

/**
 * Verifica permissões de câmera e localização
 * @returns {Promise<{camera: string, geolocation: string}>}
 */
export const checkPermissions = async () => {
  const permissions = {
    camera: 'prompt',
    geolocation: 'prompt'
  };

  try {
    if (navigator.permissions && navigator.permissions.query) {
      // Verificar câmera
      try {
        const cameraPermission = await navigator.permissions.query({ name: 'camera' });
        permissions.camera = cameraPermission.state;
        console.log('[PWA] Permissão de câmera:', cameraPermission.state);
      } catch (e) {
        console.log('[PWA] Não foi possível verificar permissão de câmera');
      }

      // Verificar localização
      try {
        const geoPermission = await navigator.permissions.query({ name: 'geolocation' });
        permissions.geolocation = geoPermission.state;
        console.log('[PWA] Permissão de localização:', geoPermission.state);
      } catch (e) {
        console.log('[PWA] Não foi possível verificar permissão de localização');
      }
    }
  } catch (error) {
    console.log('[PWA] API de permissões não disponível');
  }

  return permissions;
};

/**
 * Detecta o tipo de dispositivo
 * @returns {Object}
 */
export const detectDevice = () => {
  const ua = navigator.userAgent;
  
  const device = {
    isIOS: /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
    isAndroid: /Android/.test(ua),
    isMobile: /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua),
    isChrome: /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor),
    isSafari: /Safari/.test(ua) && /Apple Computer/.test(navigator.vendor),
    supportsHTTPS: location.protocol === 'https:' || location.hostname === 'localhost',
    supportsCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    supportsGeolocation: !!navigator.geolocation
  };
  
  console.log('[PWA] Dispositivo detectado:', device);
  return device;
};

/**
 * Verifica se o ambiente suporta PWA features
 * @returns {Object}
 */
export const checkPWASupport = () => {
  const support = {
    serviceWorker: 'serviceWorker' in navigator,
    pushNotifications: 'PushManager' in window,
    geolocation: 'geolocation' in navigator,
    camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    installable: 'BeforeInstallPromptEvent' in window,
    standalone: isPWAInstalled()
  };
  
  console.log('[PWA] Suporte PWA:', support);
  return support;
};
