import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PermissionsModal({ onComplete }) {
  const [step, setStep] = useState('welcome'); // welcome, camera, location, complete
  const [cameraGranted, setCameraGranted] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [error, setError] = useState('');

  async function requestCameraPermission() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraGranted(true);
      setStep('location');
    } catch (error) {
      console.error('Camera permission error:', error);
      if (error.name === 'NotAllowedError') {
        setError('Permissão de câmera negada. Você pode alterar isso nas configurações do navegador.');
      } else if (error.name === 'NotFoundError') {
        setError('Nenhuma câmera encontrada no dispositivo.');
      } else {
        setError('Erro ao acessar câmera. Verifique as configurações do navegador.');
      }
    }
  }

  async function requestLocationPermission() {
    setError('');
    
    // Função auxiliar para obter posição
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
      // Tentar baixa precisão primeiro (mais rápido para verificar permissão)
      try {
        await getPosition(false, 10000);
      } catch (e) {
        // Se falhou por timeout, tentar com mais tempo
        if (e.code === 3) {
          await getPosition(true, 20000);
        } else {
          throw e;
        }
      }
      
      setLocationGranted(true);
      setStep('complete');
      setTimeout(() => onComplete({ camera: cameraGranted, location: true }), 1500);
      return true;
    } catch (error) {
      console.error('Location permission error:', error);
      if (error.code === 1) {
        setError('Permissão de localização negada. Você pode alterar isso nas configurações do navegador.');
      } else {
        setError('Erro ao acessar localização. Verifique se o GPS está ativado.');
      }
      return false;
    }
  }

  function skipPermissions() {
    onComplete({ camera: cameraGranted, location: locationGranted });
  }

  const renderContent = () => {
    switch (step) {
      case 'welcome':
        return (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Bem-vindo!</h2>
            <p className="text-gray-600 mb-6">
              Para usar todas as funcionalidades do sistema, precisamos acessar sua câmera e localização.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start gap-3 mb-3">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-800">Câmera</h3>
                  <p className="text-sm text-gray-600">Para reconhecimento facial no modo kiosk</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-800">Localização</h3>
                  <p className="text-sm text-gray-600">Para registro de ponto por geolocalização</p>
                </div>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setStep('camera')}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              Continuar
            </motion.button>
            <button
              onClick={skipPermissions}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Pular por enquanto
            </button>
          </motion.div>
        );

      case 'camera':
        return (
          <motion.div
            key="camera"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Acesso à Câmera</h2>
            <p className="text-gray-600 mb-6">
              Precisamos acessar sua câmera para o reconhecimento facial no modo kiosk.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={requestCameraPermission}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold shadow-lg hover:bg-blue-700 transition-colors"
            >
              Permitir Câmera
            </motion.button>
            <button
              onClick={() => setStep('location')}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Pular esta etapa
            </button>
          </motion.div>
        );

      case 'location':
        return (
          <motion.div
            key="location"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Acesso à Localização</h2>
            <p className="text-gray-600 mb-6">
              Precisamos acessar sua localização para registrar o ponto com coordenadas GPS.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={requestLocationPermission}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold shadow-lg hover:bg-green-700 transition-colors"
            >
              Permitir Localização
            </motion.button>
            <button
              onClick={skipPermissions}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Pular esta etapa
            </button>
          </motion.div>
        );

      case 'complete':
        return (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Tudo Pronto!</h2>
            <p className="text-gray-600">
              Permissões configuradas com sucesso. Você será redirecionado...
            </p>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
      >
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
