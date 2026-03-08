import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';
import { motion } from 'framer-motion';
import LocationMap from '../components/LocationMap';

export default function RegistroPontoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
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

      // build dataHoraString in São Paulo timezone (same logic used by kiosk)
      const getSaoPauloDateTime = () => {
        const now = new Date();
        const saoPauloOffset = -3; // UTC-3 (São Paulo)
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utc + (saoPauloOffset * 3600000));
      };

      const dtSP = getSaoPauloDateTime();
      const ano = dtSP.getFullYear();
      const mes = String(dtSP.getMonth() + 1).padStart(2, '0');
      const dia = String(dtSP.getDate()).padStart(2, '0');
      const hora = String(dtSP.getHours()).padStart(2, '0');
      const minuto = String(dtSP.getMinutes()).padStart(2, '0');
      const segundo = String(dtSP.getSeconds()).padStart(2, '0');
      const dataHoraString = `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;

      const response = await apiService.registerPointByLocation(
        coords.latitude,
        coords.longitude,
        tipo,
        dataHoraString,
        coords.accuracy
      );

      if (response.success) {
        const distanceInfo = response.distance ? ` - Distância: ${response.distance}` : '';
        console.log('Resposta do servidor:', response);
        const tipoLabel = response.tipo_label || tipo;
        setSuccess(`Ponto de ${tipoLabel} registrado com sucesso!${distanceInfo}`);
        
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
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'}`}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gradient-to-r from-blue-500 to-purple-500'} px-4 py-6 shadow-xl`}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Registrar Ponto</h1>
            <p className={`${isDarkMode ? 'text-blue-100' : 'text-blue-50'} text-sm`}>Por Geolocalização</p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Toggle Tema */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              aria-label="Alternar tema"
            >
              {isDarkMode ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            
            <button
              onClick={() => navigate('/funcionario/dashboard')}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col items-center justify-start pt-8 px-4 pb-6 max-w-2xl mx-auto w-full">
        {/* Status/Alert compacto */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full mb-4 ${isDarkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'} border rounded-lg p-3 text-sm`}
          >
            <p className={`${isDarkMode ? 'text-red-200' : 'text-red-700'} flex items-center`}>
              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full mb-4 ${isDarkMode ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-3 text-sm`}
          >
            <p className={`${isDarkMode ? 'text-green-200' : 'text-green-700'} flex items-center`}>
              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </p>
          </motion.div>
        )}

        {/* Localização Display */}
        {location && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full mb-8 ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'} border rounded-2xl p-4`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-3 h-3 flex-shrink-0">
                  <div className="absolute inset-0 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 bg-green-400 rounded-full"></div>
                </div>
                <div>
                  <p className={`${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'} text-sm font-medium`}>Localização Detectada</p>
                  <p className={`${isDarkMode ? 'text-emerald-200/70' : 'text-emerald-600/70'} text-xs`}>
                    Precisão: {Math.round(location.accuracy)}m
                  </p>
                </div>
              </div>
              <button
                onClick={getCurrentLocation}
                disabled={loadingLocation}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'} ${loadingLocation ? 'opacity-50' : ''}`}
              >
                <svg className={`w-4 h-4 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'} ${loadingLocation ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Mapa */}
            <div className="mt-4">
              <LocationMap location={location} isDarkMode={isDarkMode} />
            </div>
          </motion.div>
        )}

        {/* Botões Principais - Empilhados */}
        <div className="w-full space-y-4 mb-8">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => registrarPonto('entrada')}
            disabled={loading || loadingLocation || !locationPermission}
            className={`group relative overflow-hidden rounded-2xl p-6 w-full flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              loading 
                ? 'bg-green-500' 
                : 'bg-gradient-to-br from-green-500 to-green-600 hover:shadow-lg'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              loading ? 'bg-white/20' : 'bg-white/20 group-hover:bg-white/30'
            } transition-colors flex-shrink-0`}>
              {loading ? (
                <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              )}
            </div>
            <span className="text-white font-bold text-lg">
              {loading ? 'Processando...' : 'Registrar Entrada'}
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => registrarPonto('saida')}
            disabled={loading || loadingLocation || !locationPermission}
            className={`group relative overflow-hidden rounded-2xl p-6 w-full flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              loading 
                ? 'bg-orange-500' 
                : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:shadow-lg'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              loading ? 'bg-white/20' : 'bg-white/20 group-hover:bg-white/30'
            } transition-colors flex-shrink-0`}>
              {loading ? (
                <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
            </div>
            <span className="text-white font-bold text-lg">
              {loading ? 'Processando...' : 'Registrar Saída'}
            </span>
          </motion.button>
        </div>

        {/* Info Minimalista */}
        {!location && locationPermission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`w-full text-center py-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
          >
            <svg className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'} mx-auto mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <p className="text-sm">Clique para obter sua localização</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
