import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const PERMISSIONS_KEY = '@app:permissions_requested';

export default function PermissionsTestPage() {
  const navigate = useNavigate();
  const [cameraStatus, setCameraStatus] = useState('not-tested');
  const [locationStatus, setLocationStatus] = useState('not-tested');
  const [cameraError, setCameraError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isSecure, setIsSecure] = useState(window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  function resetPermissionsFlag() {
    localStorage.removeItem(PERMISSIONS_KEY);
    alert('✅ Flag de permissões resetada!\n\nVolte para a homepage e recarregue a página para ver o modal de permissões novamente.');
  }

  async function testCamera() {
    setCameraStatus('testing');
    setCameraError('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraStatus('success');
    } catch (error) {
      setCameraStatus('error');
      setCameraError(error.message || error.name);
    }
  }

  async function testLocation() {
    setLocationStatus('testing');
    setLocationError('');
    
    const getPosition = (highAccuracy, timeout) => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: timeout,
          maximumAge: highAccuracy ? 0 : 60000
        });
      });
    };

    try {
      // Tentar baixa precisão primeiro
      try {
        await getPosition(false, 10000);
      } catch (e) {
        if (e.code === 3) {
          await getPosition(true, 20000);
        } else {
          throw e;
        }
      }
      setLocationStatus('success');
    } catch (error) {
      setLocationStatus('error');
      setLocationError(error.message || 'Erro ao obter localização');
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'testing': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'testing': return '⏳';
      default: return '⚪';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            🔍 Teste de Permissões
          </h1>

          {/* Status da Origem */}
          <div className={`p-4 rounded-lg mb-6 ${isSecure ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{isSecure ? '🔒' : '⚠️'}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {isSecure ? 'Origem Segura ✅' : 'Origem Insegura ❌'}
                </h3>
                <p className="text-sm text-gray-600">
                  URL atual: <code className="bg-white px-2 py-1 rounded">{window.location.href}</code>
                </p>
                {!isSecure && (
                  <div className="mt-2 text-sm text-red-700">
                    <p className="font-semibold">❌ Acesso via IP detectado!</p>
                    <p>Câmera e geolocalização só funcionam em:</p>
                    <ul className="list-disc ml-5 mt-1">
                      <li>localhost (http://localhost:3000)</li>
                      <li>127.0.0.1 (http://127.0.0.1:3000)</li>
                      <li>HTTPS (https://...)</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Informações do Sistema */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-3">ℹ️ Informações do Sistema</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Protocolo:</span>
                <code className="bg-white px-2 py-1 rounded">{window.location.protocol}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hostname:</span>
                <code className="bg-white px-2 py-1 rounded">{window.location.hostname}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Porta:</span>
                <code className="bg-white px-2 py-1 rounded">{window.location.port}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Navegador:</span>
                <code className="bg-white px-2 py-1 rounded text-xs">{navigator.userAgent.split(' ')[0]}</code>
              </div>
            </div>
          </div>

          {/* Teste de Câmera */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                📷 Câmera
                <span className={getStatusColor(cameraStatus)}>
                  {getStatusIcon(cameraStatus)}
                </span>
              </h3>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={testCamera}
                disabled={cameraStatus === 'testing' || !isSecure}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isSecure
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {cameraStatus === 'testing' ? 'Testando...' : 'Testar Câmera'}
              </motion.button>
            </div>
            {cameraError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <strong>Erro:</strong> {cameraError}
              </div>
            )}
          </div>

          {/* Teste de Geolocalização */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                📍 Geolocalização
                <span className={getStatusColor(locationStatus)}>
                  {getStatusIcon(locationStatus)}
                </span>
              </h3>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={testLocation}
                disabled={locationStatus === 'testing' || !isSecure}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isSecure
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {locationStatus === 'testing' ? 'Testando...' : 'Testar Localização'}
              </motion.button>
            </div>
            {locationError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <strong>Erro:</strong> {locationError}
              </div>
            )}
          </div>

          {/* Instruções */}
          {!isSecure && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">💡 Como Corrigir</h3>
              <ol className="list-decimal ml-5 space-y-1 text-sm text-yellow-700">
                <li>Feche esta aba</li>
                <li>Abra uma nova aba</li>
                <li>Digite: <code className="bg-white px-2 py-1 rounded">http://localhost:3000</code></li>
                <li>Pressione Enter</li>
              </ol>
            </div>
          )}

          {isSecure && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 text-sm">
                ✅ Sua origem é segura! Você pode testar as permissões acima.
              </p>
            </div>
          )}

          {/* Botão Reset */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">🔄 Resetar Modal de Permissões</h3>
            <p className="text-sm text-gray-600 mb-3">
              Use este botão para resetar a flag e ver o modal de permissões novamente na homepage.
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={resetPermissionsFlag}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Resetar Flag de Permissões
            </motion.button>
          </div>
        </motion.div>

        {/* Botão Voltar */}
        <motion.a
          href="/"
          whileTap={{ scale: 0.95 }}
          className="mt-4 block text-center bg-white text-gray-700 py-3 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          ← Voltar para Home
        </motion.a>
      </div>
    </div>
  );
}
