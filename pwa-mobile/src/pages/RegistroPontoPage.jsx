import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { motion } from 'framer-motion';

export default function RegistroPontoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkLocationPermission();
  }, []);

  function checkLocationPermission() {
    if ('geolocation' in navigator) {
      setLocationPermission(true);
    } else {
      setLocationPermission(false);
      setError('Seu navegador não suporta geolocalização');
    }
  }

  async function getCurrentLocation() {
    setLoadingLocation(true);
    setError('');
    setSuccess('Solicitando acesso à localização...');
    
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

    try {
      let position;
      
      // Estratégia em 3 níveis (funciona em desktop e mobile):
      try {
        console.log('[LOCATION] Tentando localização rápida (cache/IP)...');
        position = await getPosition(false, 8000, 300000); // Cache 5 min
      } catch (e1) {
        console.log('[LOCATION] Tentando baixa precisão...');
        setSuccess('Obtendo localização...');
        try {
          position = await getPosition(false, 15000, 0);
        } catch (e2) {
          console.log('[LOCATION] Tentando GPS (alta precisão)...');
          setSuccess('Obtendo localização precisa...');
          position = await getPosition(true, 30000, 0);
        }
      }

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      
      console.log('[LOCATION] Localização obtida:', coords);
      setLocation(coords);
      setLoadingLocation(false);
      setSuccess('');
      return coords;

    } catch (error) {
      setLoadingLocation(false);
      setSuccess('');
      let errorMessage = 'Não foi possível obter sua localização';
      
      if (error.code === 1) {
        errorMessage = 'Permissão de localização negada. Por favor, permita o acesso à localização nas configurações do navegador.';
      } else if (error.code === 2) {
        errorMessage = 'Localização indisponível. Verifique suas configurações de rede.';
      } else if (error.code === 3) {
        errorMessage = 'Não foi possível obter localização. Tente novamente.';
      }
      
      setError(errorMessage);
      throw error;
    }
  }

  async function registrarPonto(tipo) {
    if (!locationPermission) {
      setError('Permissão de localização não concedida');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const coords = await getCurrentLocation();
      
      if (!coords) {
        setLoading(false);
        return;
      }

      // Log detalhado para debug
      console.log('=== DEBUG LOCALIZAÇÃO ===');
      console.log('Latitude:', coords.latitude);
      console.log('Longitude:', coords.longitude);
      console.log('Precisão:', coords.accuracy, 'm');
      console.log('Tipo:', tipo);
      console.log('========================');

      // Mostrar coordenadas na tela para debug (remover depois)
      alert(`Debug:\nLat: ${coords.latitude}\nLng: ${coords.longitude}\nPrecisão: ${coords.accuracy}m`);

      const response = await apiService.registerPointByLocation(
        coords.latitude,
        coords.longitude,
        tipo
      );

      if (response.success) {
        const distanceInfo = response.distance ? ` - Distância: ${response.distance}` : '';
        console.log('Resposta do servidor:', response);
        setSuccess(`Ponto de ${tipo} registrado com sucesso!${distanceInfo}`);
        
        setTimeout(() => {
          navigate('/funcionario/dashboard');
        }, 2000);
      } else {
        throw new Error(response.error || 'Erro ao registrar ponto');
      }
    } catch (err) {
      let errorMessage = 'Erro ao registrar ponto';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-6 shadow-xl">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/funcionario/dashboard')}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors mr-4"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          
          <div>
            <h1 className="text-2xl font-bold text-white">Registrar Ponto</h1>
            <p className="text-blue-100 text-sm">Por Geolocalização</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Alertas */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-red-500/20 border border-red-500/50 rounded-xl p-4"
          >
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-100 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-green-500/20 border border-green-500/50 rounded-xl p-4"
          >
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-100 text-sm">{success}</p>
            </div>
          </motion.div>
        )}

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          
          <h2 className="text-white text-xl font-bold text-center mb-2">
            Registro por Localização
          </h2>
          <p className="text-white/70 text-sm text-center mb-4">
            Sua localização será verificada para confirmar que você está na empresa
          </p>

          {location && (
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-white/50 text-xs mb-2">Localização Atual</p>
              <p className="text-white text-sm font-mono">
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </p>
              {location.accuracy && (
                <p className="text-white/50 text-xs mt-2">
                  Precisão: {Math.round(location.accuracy)}m
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Botões de Registro */}
        <div className="space-y-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => registrarPonto('entrada')}
            disabled={loading || loadingLocation || !locationPermission}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-6 w-6 text-white mr-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-white font-bold text-lg">Registrando...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <svg className="w-6 h-6 text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="text-white font-bold text-lg">Registrar Entrada</span>
              </div>
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => registrarPonto('saida')}
            disabled={loading || loadingLocation || !locationPermission}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-6 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-6 w-6 text-white mr-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-white font-bold text-lg">Registrando...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <svg className="w-6 h-6 text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-white font-bold text-lg">Registrar Saída</span>
              </div>
            )}
          </motion.button>
        </div>

        {/* Botão de atualizar localização */}
        {locationPermission && !loading && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={getCurrentLocation}
            disabled={loadingLocation}
            className="w-full mt-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl py-3 px-4 disabled:opacity-50"
          >
            <div className="flex items-center justify-center">
              <svg 
                className={`w-5 h-5 text-white mr-2 ${loadingLocation ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-white font-medium">
                {loadingLocation ? 'Obtendo Localização...' : 'Atualizar Localização'}
              </span>
            </div>
          </motion.button>
        )}

        {/* Info */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-blue-200 text-sm">
              <p className="font-medium mb-1">Importante:</p>
              <ul className="space-y-1 text-blue-200/80">
                <li>• Permita o acesso à localização quando solicitado</li>
                <li>• Ative o GPS para melhor precisão</li>
                <li>• Você deve estar nas proximidades da empresa</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
