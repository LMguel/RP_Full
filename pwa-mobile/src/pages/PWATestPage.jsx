import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  getLocation,
  openCamera,
  stopCamera,
  capturePhoto,
  checkPermissions,
  isPWAInstalled,
  detectDevice,
  checkPWASupport,
  listCameras
} from '../utils/pwaUtils';

export default function PWATestPage() {
  // Estados de localização
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  
  // Estados de câmera
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [photo, setPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [cameras, setCameras] = useState([]);
  
  // Estados de informações do sistema
  const [permissions, setPermissions] = useState({ camera: 'prompt', geolocation: 'prompt' });
  const [isPWA, setIsPWA] = useState(false);
  const [device, setDevice] = useState({});
  const [pwaSupport, setPwaSupport] = useState({});
  
  const videoRef = useRef(null);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const loadSystemInfo = async () => {
    setIsPWA(isPWAInstalled());
    setDevice(detectDevice());
    setPwaSupport(checkPWASupport());
    await loadPermissions();
    await loadCameras();
  };

  const loadPermissions = async () => {
    const perms = await checkPermissions();
    setPermissions(perms);
  };

  const loadCameras = async () => {
    try {
      const cameraList = await listCameras();
      setCameras(cameraList);
    } catch (error) {
      console.error('Erro ao listar câmeras:', error);
    }
  };

  const handleGetLocation = async () => {
    setLoadingLocation(true);
    setLocationError('');
    setLocation(null);

    try {
      const pos = await getLocation();
      setLocation(pos);
      await loadPermissions();
    } catch (error) {
      setLocationError(error.message);
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleOpenCamera = async () => {
    setCameraError('');
    
    try {
      const stream = await openCamera(facingMode);
      setCameraStream(stream);
      await loadPermissions();
      await loadCameras();
    } catch (error) {
      setCameraError(error.message);
    }
  };

  const handleCloseCamera = () => {
    stopCamera(cameraStream);
    setCameraStream(null);
    setPhoto(null);
  };

  const handleCapturePhoto = async () => {
    try {
      const blob = await capturePhoto(videoRef.current);
      const url = URL.createObjectURL(blob);
      setPhoto(url);
    } catch (error) {
      alert('Erro ao capturar foto: ' + error.message);
    }
  };

  const handleToggleCamera = () => {
    handleCloseCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const getPermissionColor = (state) => {
    switch (state) {
      case 'granted': return 'bg-green-100 text-green-800';
      case 'denied': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getPermissionText = (state) => {
    switch (state) {
      case 'granted': return '✅ Permitida';
      case 'denied': return '❌ Negada';
      default: return '⏳ Não solicitada';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 mb-6"
        >
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <span>🔧</span> PWA Test Page
          </h1>
          <p className="text-white/80">
            Teste de câmera, localização e permissões
          </p>
          
          {/* Status PWA */}
          <div className="mt-4 flex items-center gap-3 p-3 bg-white/10 rounded-xl">
            <div className={`w-3 h-3 rounded-full ${isPWA ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
            <span className="text-sm font-medium text-white">
              {isPWA ? '✅ PWA Instalado' : '⚠️ Rodando no Navegador'}
            </span>
          </div>
        </motion.div>

        {/* Informações do Dispositivo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">📱 Informações do Dispositivo</h2>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="iOS" value={device.isIOS ? '✅' : '❌'} />
            <InfoCard label="Android" value={device.isAndroid ? '✅' : '❌'} />
            <InfoCard label="Mobile" value={device.isMobile ? '✅' : '❌'} />
            <InfoCard label="HTTPS" value={device.supportsHTTPS ? '✅' : '❌'} />
            <InfoCard label="Câmera API" value={device.supportsCamera ? '✅' : '❌'} />
            <InfoCard label="GPS API" value={device.supportsGeolocation ? '✅' : '❌'} />
          </div>
        </motion.div>

        {/* Suporte PWA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">⚙️ Suporte PWA</h2>
          <div className="space-y-2">
            <SupportRow label="Service Worker" supported={pwaSupport.serviceWorker} />
            <SupportRow label="Push Notifications" supported={pwaSupport.pushNotifications} />
            <SupportRow label="Geolocalização" supported={pwaSupport.geolocation} />
            <SupportRow label="Câmera" supported={pwaSupport.camera} />
            <SupportRow label="Instalável" supported={pwaSupport.installable} />
            <SupportRow label="Standalone" supported={pwaSupport.standalone} />
          </div>
        </motion.div>

        {/* Permissões */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">📋 Permissões</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
              <span className="font-medium text-white flex items-center gap-2">
                <span>📍</span> Localização
              </span>
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getPermissionColor(permissions.geolocation)}`}>
                {getPermissionText(permissions.geolocation)}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
              <span className="font-medium text-white flex items-center gap-2">
                <span>📷</span> Câmera
              </span>
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getPermissionColor(permissions.camera)}`}>
                {getPermissionText(permissions.camera)}
              </span>
            </div>
          </div>

          {cameras.length > 0 && (
            <div className="mt-4 p-4 bg-white/10 rounded-xl">
              <p className="text-white font-medium mb-2">Câmeras disponíveis: {cameras.length}</p>
              <div className="text-sm text-white/70 space-y-1">
                {cameras.map((camera, index) => (
                  <div key={camera.deviceId}>
                    {index + 1}. {camera.label || `Câmera ${index + 1}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Teste de Localização */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">📍 Teste de Localização</h2>
          
          <button
            onClick={handleGetLocation}
            disabled={loadingLocation}
            className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {loadingLocation ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Obtendo localização...
              </span>
            ) : (
              '📍 Solicitar Localização'
            )}
          </button>

          {locationError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl"
            >
              <p className="text-red-200 font-medium">❌ {locationError}</p>
            </motion.div>
          )}

          {location && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 bg-green-500/20 border border-green-500/50 rounded-xl"
            >
              <p className="text-green-200 font-bold mb-3">✅ Localização obtida!</p>
              <div className="space-y-2 text-sm text-white/90">
                <div className="flex justify-between">
                  <span className="font-medium">Latitude:</span>
                  <span className="font-mono">{location.latitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Longitude:</span>
                  <span className="font-mono">{location.longitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Precisão:</span>
                  <span className="font-mono">{location.accuracy.toFixed(2)}m</span>
                </div>
                {location.altitude && (
                  <div className="flex justify-between">
                    <span className="font-medium">Altitude:</span>
                    <span className="font-mono">{location.altitude.toFixed(2)}m</span>
                  </div>
                )}
                <div className="pt-2 border-t border-white/20">
                  <span className="text-xs text-white/60">
                    {new Date(location.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Teste de Câmera */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">📷 Teste de Câmera</h2>
          
          {!cameraStream ? (
            <button
              onClick={handleOpenCamera}
              className="w-full bg-green-600 text-white px-6 py-4 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl"
            >
              📷 Abrir Câmera {facingMode === 'user' ? 'Frontal' : 'Traseira'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={handleCapturePhoto}
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg"
                >
                  📸 Capturar
                </button>
                <button
                  onClick={handleToggleCamera}
                  className="px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-lg"
                >
                  🔄
                </button>
                <button
                  onClick={handleCloseCamera}
                  className="px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg"
                >
                  ❌
                </button>
              </div>
            </div>
          )}

          {cameraError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl"
            >
              <p className="text-red-200 font-medium">❌ {cameraError}</p>
            </motion.div>
          )}

          {cameraStream && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-xl border-4 border-white/30 shadow-2xl"
              />
              <p className="text-sm text-white/70 mt-2 text-center">
                📹 Câmera {facingMode === 'user' ? 'frontal' : 'traseira'} ativa
              </p>
            </motion.div>
          )}

          {photo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4"
            >
              <p className="font-bold text-white mb-2">📸 Foto Capturada:</p>
              <img 
                src={photo} 
                alt="Captura" 
                className="w-full rounded-xl border-4 border-green-500/50 shadow-2xl" 
              />
            </motion.div>
          )}
        </motion.div>

        {/* Instruções */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-blue-500/20 border border-blue-500/50 rounded-2xl p-6"
        >
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <span>ℹ️</span> Instruções de Teste
          </h3>
          <ul className="text-sm text-white/90 space-y-2">
            <li className="flex gap-2">
              <span>✅</span>
              <span><strong>Desenvolvimento:</strong> Funciona em localhost sem HTTPS</span>
            </li>
            <li className="flex gap-2">
              <span>✅</span>
              <span><strong>Rede local:</strong> Use http://192.168.x.x:3000 no celular</span>
            </li>
            <li className="flex gap-2">
              <span>✅</span>
              <span><strong>Produção:</strong> Requer HTTPS (Vercel, Netlify, etc)</span>
            </li>
            <li className="flex gap-2">
              <span>📱</span>
              <span><strong>iOS:</strong> Safari → Compartilhar → Adicionar à Tela Inicial</span>
            </li>
            <li className="flex gap-2">
              <span>🤖</span>
              <span><strong>Android:</strong> Chrome → Menu → Instalar app</span>
            </li>
            <li className="flex gap-2">
              <span>🔒</span>
              <span><strong>Permissões:</strong> Sempre conceda ao clicar nos botões</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

// Componentes auxiliares
function InfoCard({ label, value }) {
  return (
    <div className="p-3 bg-white/10 rounded-xl">
      <p className="text-white/60 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
    </div>
  );
}

function SupportRow({ label, supported }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
      <span className="text-white font-medium">{label}</span>
      <span className={`text-2xl ${supported ? '' : 'opacity-30'}`}>
        {supported ? '✅' : '❌'}
      </span>
    </div>
  );
}
